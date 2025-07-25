import { Simnet } from "@hirosystems/clarinet-sdk";
import { EventEmitter } from "events";
import {
  argsToCV,
  functionToArbitrary,
  getFunctionsListForContract,
} from "./shared";
import { LocalContext } from "./invariant.types";
import { Cl, cvToJSON, cvToString } from "@stacks/transactions";
import { reporter } from "./heatstroke";
import fc from "fast-check";
import { dim, green, red, underline } from "ansicolor";
import { ContractInterfaceFunction } from "@hirosystems/clarinet-sdk-wasm";
import {
  buildTraitReferenceMap,
  enrichInterfaceWithTraitData,
  extractProjectTraitImplementations,
  isTraitReferenceFunction,
} from "./traits";
import { EnrichedContractInterfaceFunction } from "./shared.types";
import { DialerRegistry, PostDialerError, PreDialerError } from "./dialer";
import { Statistics } from "./heatstroke.types";

/**
 * Runs invariant testing on the target contract and logs the progress. Reports
 * the test results through a custom reporter.
 * @param simnet The Simnet instance.
 * @param targetContractName The name of the target contract.
 * @param rendezvousList The list of contract IDs for each target contract.
 * @param rendezvousAllFunctions The map of all function interfaces for each
 * target contract.
 * @param seed The seed for reproducible invariant testing.
 * @param path The path for reproducible invariant testing.
 * @param runs The number of test runs.
 * @param dialerRegistry The custom dialer registry.
 * @param radio The custom logging event emitter.
 * @returns void
 */
export const checkInvariants = async (
  simnet: Simnet,
  targetContractName: string,
  rendezvousList: string[],
  rendezvousAllFunctions: Map<string, ContractInterfaceFunction[]>,
  seed: number | undefined,
  path: string | undefined,
  runs: number | undefined,
  dialerRegistry: DialerRegistry | undefined,
  radio: EventEmitter
) => {
  const statistics: Statistics = {
    sut: {
      successful: new Map<string, number>(),
      failed: new Map<string, number>(),
    },
    invariant: {
      successful: new Map<string, number>(),
      failed: new Map<string, number>(),
    },
  };
  // A map where the keys are the Rendezvous identifiers and the values are
  // arrays of their SUT (System Under Test) functions. This map will be used
  // to access the SUT functions for each Rendezvous contract afterwards.
  const rendezvousSutFunctions = filterSutFunctions(rendezvousAllFunctions);

  // The Rendezvous identifier is the first one in the list. Only one contract
  // can be fuzzed at a time.
  const rendezvousContractId = rendezvousList[0];

  for (const functionInterface of rendezvousSutFunctions.get(
    rendezvousContractId
  )!) {
    statistics.sut!.successful.set(functionInterface.name, 0);
    statistics.sut!.failed.set(functionInterface.name, 0);
  }

  // A map where the keys are the Rendezvous identifiers and the values are
  // arrays of their invariant functions. This map will be used to access the
  // invariant functions for each Rendezvous contract afterwards.
  const rendezvousInvariantFunctions = filterInvariantFunctions(
    rendezvousAllFunctions
  );

  for (const functionInterface of rendezvousInvariantFunctions.get(
    rendezvousContractId
  )!) {
    statistics.invariant!.successful.set(functionInterface.name, 0);
    statistics.invariant!.failed.set(functionInterface.name, 0);
  }

  const traitReferenceSutFunctions = rendezvousSutFunctions
    .get(rendezvousContractId)!
    .filter((fn) => isTraitReferenceFunction(fn));

  const traitReferenceInvariantFunctions = rendezvousInvariantFunctions
    .get(rendezvousContractId)!
    .filter((fn) => isTraitReferenceFunction(fn));

  const projectTraitImplementations =
    extractProjectTraitImplementations(simnet);

  if (
    Object.entries(projectTraitImplementations).length === 0 &&
    (traitReferenceSutFunctions.length > 0 ||
      traitReferenceInvariantFunctions.length > 0)
  ) {
    const foundTraitReferenceMessage =
      traitReferenceSutFunctions.length > 0 &&
      traitReferenceInvariantFunctions.length > 0
        ? "public functions and invariants"
        : traitReferenceSutFunctions.length > 0
        ? "public functions"
        : "invariants";

    radio.emit(
      "logMessage",
      red(
        `\nFound ${foundTraitReferenceMessage} referencing traits, but no trait implementations were found in the project.
\nNote: You can add contracts implementing traits either as project contracts or as Clarinet requirements. For more details, visit: https://www.hiro.so/clarinet/.
\n`
      )
    );
    return;
  }

  const enrichedSutFunctionsInterfaces =
    traitReferenceSutFunctions.length > 0
      ? enrichInterfaceWithTraitData(
          simnet.getContractAST(targetContractName),
          buildTraitReferenceMap(
            rendezvousSutFunctions.get(rendezvousContractId)!
          ),
          rendezvousSutFunctions.get(rendezvousContractId)!,
          rendezvousContractId
        )
      : rendezvousSutFunctions;

  const enrichedInvariantFunctionsInterfaces =
    traitReferenceInvariantFunctions.length > 0
      ? enrichInterfaceWithTraitData(
          simnet.getContractAST(targetContractName),
          buildTraitReferenceMap(
            rendezvousInvariantFunctions.get(rendezvousContractId)!
          ),
          rendezvousInvariantFunctions.get(rendezvousContractId)!,
          rendezvousContractId
        )
      : rendezvousInvariantFunctions;

  // Set up local context to track SUT function call counts.
  const localContext = initializeLocalContext(enrichedSutFunctionsInterfaces);

  // Set up context in simnet by initializing state for SUT.
  initializeClarityContext(simnet, enrichedSutFunctionsInterfaces);

  radio.emit(
    "logMessage",
    `\nStarting invariant testing type for the ${targetContractName} contract...\n`
  );

  const simnetAccounts = simnet.getAccounts();

  const eligibleAccounts = new Map(
    [...simnetAccounts].filter(([key]) => key !== "faucet")
  );

  const simnetAddresses = Array.from(simnetAccounts.values());

  const functions = getFunctionsListForContract(
    enrichedSutFunctionsInterfaces,
    rendezvousContractId
  );

  const invariants = getFunctionsListForContract(
    enrichedInvariantFunctionsInterfaces,
    rendezvousContractId
  );

  if (functions?.length === 0) {
    radio.emit(
      "logMessage",
      red(
        `No public functions found for the "${targetContractName}" contract. Without public functions, no state transitions can happen inside the contract, and the invariant test is not meaningful.\n`
      )
    );
    return;
  }

  if (invariants?.length === 0) {
    radio.emit(
      "logMessage",
      red(
        `No invariant functions found for the "${targetContractName}" contract. Beware, for your contract may be exposed to unforeseen issues.\n`
      )
    );
    return;
  }

  const radioReporter = (runDetails: any) => {
    reporter(runDetails, radio, "invariant", statistics);
  };

  await fc.assert(
    fc.asyncProperty(
      fc
        .record({
          // The target contract identifier. It is a constant value equal
          // to the first contract in the list. The arbitrary is still needed,
          // being used for reporting purposes in `heatstroke.ts`.
          rendezvousContractId: fc.constant(rendezvousContractId),
          invariantCaller: fc.constantFrom(...eligibleAccounts.entries()),
          canMineBlocks: fc.boolean(),
        })
        .chain((r) =>
          fc
            .record({
              selectedFunctions: fc.array(fc.constantFrom(...functions), {
                minLength: 1, // At least one function must be selected.
              }),
              selectedInvariant: fc.constantFrom(...invariants),
            })
            .map((selectedFunctions) => ({ ...r, ...selectedFunctions }))
        )
        .chain((r) =>
          fc
            .record({
              sutCallers: fc.array(
                fc.constantFrom(...eligibleAccounts.entries()),
                {
                  minLength: r.selectedFunctions.length,
                  maxLength: r.selectedFunctions.length,
                }
              ),
              selectedFunctionsArgsList: fc.tuple(
                ...r.selectedFunctions.map((selectedFunction) =>
                  fc.tuple(
                    ...functionToArbitrary(
                      selectedFunction,
                      simnetAddresses,
                      projectTraitImplementations
                    )
                  )
                )
              ),
              invariantArgs: fc.tuple(
                ...functionToArbitrary(
                  r.selectedInvariant,
                  simnetAddresses,
                  projectTraitImplementations
                )
              ),
            })
            .map((args) => ({ ...r, ...args }))
        )
        .chain((r) =>
          fc
            .record({
              burnBlocks: r.canMineBlocks
                ? // This arbitrary produces integers with a maximum value
                  // inversely proportional to the number of runs:
                  // - Fewer runs result in a higher maximum burn blocks,
                  //   allowing more blocks to be mined.
                  // - More runs result in a lower maximum burn blocks, as more
                  //   blocks are mined overall.
                  fc.integer({
                    min: 1,
                    max: Math.ceil(100_000 / (runs || 100)),
                  })
                : fc.constant(0),
            })
            .map((burnBlocks) => ({ ...r, ...burnBlocks }))
        ),
      async (r) => {
        const selectedFunctionsArgsCV = r.selectedFunctions.map(
          (selectedFunction, index) =>
            argsToCV(selectedFunction, r.selectedFunctionsArgsList[index])
        );
        const selectedInvariantArgsCV = argsToCV(
          r.selectedInvariant,
          r.invariantArgs
        );

        for (const [index, selectedFunction] of r.selectedFunctions.entries()) {
          const [sutCallerWallet, sutCallerAddress] = r.sutCallers[index];

          const printedFunctionArgs = r.selectedFunctionsArgsList[index]
            .map((arg) => {
              try {
                return typeof arg === "object"
                  ? JSON.stringify(arg)
                  : (arg as any).toString();
              } catch {
                return "[Circular]";
              }
            })
            .join(" ");

          try {
            if (dialerRegistry !== undefined) {
              await dialerRegistry.executePreDialers({
                selectedFunction: selectedFunction,
                functionCall: undefined,
                clarityValueArguments: selectedFunctionsArgsCV[index],
              });
            }
          } catch (error: any) {
            throw new PreDialerError(error.message);
          }

          try {
            const functionCall = simnet.callPublicFn(
              r.rendezvousContractId,
              selectedFunction.name,
              selectedFunctionsArgsCV[index],
              sutCallerAddress
            );

            const functionCallResultJson = cvToJSON(functionCall.result);

            // Reaching this point means the function call went through, but it
            // may still have returned an error result. Get the result, convert
            // it to Clarity string format, and report it to improve the user
            // experiance by providing important information about the function
            // call during the run.
            const selectedFunctionClarityResult = cvToString(
              functionCall.result
            );

            if (functionCallResultJson.success) {
              statistics.sut!.successful.set(
                selectedFunction.name,
                statistics.sut!.successful.get(selectedFunction.name)! + 1
              );
              localContext[r.rendezvousContractId][selectedFunction.name]++;

              simnet.callPublicFn(
                r.rendezvousContractId,
                "update-context",
                [
                  Cl.stringAscii(selectedFunction.name),
                  Cl.uint(
                    localContext[r.rendezvousContractId][selectedFunction.name]
                  ),
                ],
                simnet.deployer
              );

              // Function call passed.
              radio.emit(
                "logMessage",
                `₿ ${simnet.burnBlockHeight.toString().padStart(8)} ` +
                  `Ӿ ${simnet.blockHeight.toString().padStart(8)}   ` +
                  dim(`${sutCallerWallet}        `) +
                  `${targetContractName} ` +
                  `${underline(selectedFunction.name)} ` +
                  `${printedFunctionArgs} ` +
                  green(selectedFunctionClarityResult)
              );

              try {
                if (dialerRegistry !== undefined) {
                  await dialerRegistry.executePostDialers({
                    selectedFunction: selectedFunction,
                    functionCall: functionCall,
                    clarityValueArguments: selectedFunctionsArgsCV[index],
                  });
                }
              } catch (error: any) {
                throw new PostDialerError(error.message);
              }
            } else {
              // Function call failed.
              statistics.sut!.failed.set(
                selectedFunction.name,
                statistics.sut!.failed.get(selectedFunction.name)! + 1
              );
              radio.emit(
                "logMessage",
                dim(
                  `₿ ${simnet.burnBlockHeight.toString().padStart(8)} ` +
                    `Ӿ ${simnet.blockHeight.toString().padStart(8)}   ` +
                    `${sutCallerWallet}        ` +
                    `${targetContractName} ` +
                    `${underline(selectedFunction.name)} ` +
                    `${printedFunctionArgs} ` +
                    red(selectedFunctionClarityResult)
                )
              );
            }
          } catch (error: any) {
            if (
              error instanceof PreDialerError ||
              error instanceof PostDialerError
            ) {
              throw error;
            } else {
              const displayedError =
                error &&
                typeof error === "string" &&
                error.toLowerCase().includes("runtime")
                  ? "(runtime)"
                  : "(unknown)";
              // If the function call fails with a runtime error, log a dimmed
              // message. Since the public function result is only logged and
              // does not affect the run, there's no need to throw an error.
              radio.emit(
                "logMessage",
                dim(
                  `₿ ${simnet.burnBlockHeight.toString().padStart(8)} ` +
                    `Ӿ ${simnet.blockHeight.toString().padStart(8)}   ` +
                    `${sutCallerWallet}        ` +
                    `${targetContractName} ` +
                    `${underline(selectedFunction.name)} ` +
                    `${printedFunctionArgs} ` +
                    red(displayedError)
                )
              );
            }
          }
        }

        const printedInvariantArgs = r.invariantArgs
          .map((arg) => {
            try {
              return typeof arg === "object"
                ? JSON.stringify(arg)
                : arg.toString();
            } catch {
              return "[Circular]";
            }
          })
          .join(" ");

        const [invariantCallerWallet, invariantCallerAddress] =
          r.invariantCaller;

        try {
          const { result: invariantCallResult } = simnet.callReadOnlyFn(
            r.rendezvousContractId,
            r.selectedInvariant.name,
            selectedInvariantArgsCV,
            invariantCallerAddress
          );

          const invariantCallResultJson = cvToJSON(invariantCallResult);

          const invariantCallClarityResult = cvToString(invariantCallResult);

          if (invariantCallResultJson.value === true) {
            statistics.invariant!.successful.set(
              r.selectedInvariant.name,
              statistics.invariant!.successful.get(r.selectedInvariant.name)! +
                1
            );
            radio.emit(
              "logMessage",
              `₿ ${simnet.burnBlockHeight.toString().padStart(8)} ` +
                `Ӿ ${simnet.blockHeight.toString().padStart(8)}   ` +
                `${dim(invariantCallerWallet)} ` +
                `${green("[PASS]")} ` +
                `${targetContractName} ` +
                `${underline(r.selectedInvariant.name)} ` +
                `${printedInvariantArgs} ` +
                green(invariantCallClarityResult)
            );
          } else {
            statistics.invariant!.failed.set(
              r.selectedInvariant.name,
              statistics.invariant!.failed.get(r.selectedInvariant.name)! + 1
            );
            radio.emit(
              "logMessage",
              red(
                `₿ ${simnet.burnBlockHeight.toString().padStart(8)} ` +
                  `Ӿ ${simnet.blockHeight.toString().padStart(8)}   ` +
                  `${invariantCallerWallet} ` +
                  `[FAIL] ` +
                  `${targetContractName} ` +
                  `${underline(r.selectedInvariant.name)} ` +
                  `${printedInvariantArgs} ` +
                  red(invariantCallClarityResult)
              )
            );

            // Invariant call went through, but returned something other than
            // `true`. Create a custom error to distinguish this case from
            // runtime errors.
            throw new FalsifiedInvariantError(
              `Invariant failed for ${targetContractName} contract: "${r.selectedInvariant.name}" returned ${invariantCallClarityResult}`
            );
          }
        } catch (error: any) {
          // Log errors that aren't already handled as falsified invariants.
          // This prevents duplicate error messages for the same failure.
          if (!(error instanceof FalsifiedInvariantError)) {
            radio.emit(
              "logMessage",
              red(
                `₿ ${simnet.burnBlockHeight.toString().padStart(8)} ` +
                  `Ӿ ${simnet.blockHeight.toString().padStart(8)}   ` +
                  `${invariantCallerWallet} ` +
                  `[FAIL] ` +
                  `${targetContractName} ` +
                  `${underline(r.selectedInvariant.name)} ` +
                  printedInvariantArgs
              )
            );
          }

          // Re-throw the error for fast-check to catch and process.
          throw error;
        }

        if (r.canMineBlocks) {
          simnet.mineEmptyBurnBlocks(r.burnBlocks);
        }
      }
    ),
    {
      verbose: true,
      reporter: radioReporter,
      seed: seed,
      path: path,
      numRuns: runs,
    }
  );
};

/**
 * Initializes the local context, setting the number of times each function
 * has been called to zero.
 * @param rendezvousSutFunctions The Rendezvous functions.
 * @returns The initialized local context.
 */
export const initializeLocalContext = (
  rendezvousSutFunctions: Map<string, EnrichedContractInterfaceFunction[]>
): LocalContext =>
  Object.fromEntries(
    Array.from(rendezvousSutFunctions.entries()).map(
      ([contractId, functions]) => [
        contractId,
        Object.fromEntries(functions.map((f) => [f.name, 0])),
      ]
    )
  );

export const initializeClarityContext = (
  simnet: Simnet,
  rendezvousSutFunctions: Map<string, EnrichedContractInterfaceFunction[]>
) =>
  rendezvousSutFunctions.forEach((fns, contractId) => {
    fns.forEach((fn) => {
      const { result: initialize } = simnet.callPublicFn(
        contractId,
        "update-context",
        [Cl.stringAscii(fn.name), Cl.uint(0)],
        simnet.deployer
      );
      const jsonResult = cvToJSON(initialize);
      if (!jsonResult.value || !jsonResult.success) {
        throw new Error(
          `Failed to initialize the context for function: ${fn.name}.`
        );
      }
    });
  });

/**
 * Filter the System Under Test (`SUT`) functions from the map of all contract
 * functions.
 *
 * The SUT functions are the ones that have `public` access since they are
 * capable of changing the contract state, and they are not test functions.
 * @param allFunctionsMap The map containing all the functions for each
 * Rendezvous contract.
 * @returns A map containing the filtered SUT functions for each Rendezvous
 * contract.
 */
const filterSutFunctions = (
  allFunctionsMap: Map<string, ContractInterfaceFunction[]>
) =>
  new Map(
    Array.from(allFunctionsMap, ([contractId, functions]) => [
      contractId,
      functions.filter(
        (f) =>
          f.access === "public" &&
          f.name !== "update-context" &&
          !f.name.startsWith("test-")
      ),
    ])
  );

const filterInvariantFunctions = (
  allFunctionsMap: Map<string, ContractInterfaceFunction[]>
) =>
  new Map(
    Array.from(allFunctionsMap, ([contractId, functions]) => [
      contractId,
      functions.filter(
        ({ access, name }) =>
          access === "read_only" && name.startsWith("invariant-")
      ),
    ])
  );

class FalsifiedInvariantError extends Error {
  constructor(message: string) {
    super(message);
  }
}
