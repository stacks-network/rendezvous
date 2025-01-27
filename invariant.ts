import { Simnet } from "@hirosystems/clarinet-sdk";
import { EventEmitter } from "events";
import {
  argsToCV,
  functionToArbitrary,
  getFunctionsListForContract,
} from "./shared";
import { LocalContext } from "./invariant.types";
import { Cl, cvToJSON } from "@stacks/transactions";
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
 * @param radio The custom logging event emitter.
 * @returns void
 */
export const checkInvariants = (
  simnet: Simnet,
  targetContractName: string,
  rendezvousList: string[],
  rendezvousAllFunctions: Map<string, ContractInterfaceFunction[]>,
  seed: number | undefined,
  path: string | undefined,
  runs: number | undefined,
  radio: EventEmitter
) => {
  // A map where the keys are the Rendezvous identifiers and the values are
  // arrays of their SUT (System Under Test) functions. This map will be used
  // to access the SUT functions for each Rendezvous contract afterwards.
  const rendezvousSutFunctions = filterSutFunctions(rendezvousAllFunctions);

  // A map where the keys are the Rendezvous identifiers and the values are
  // arrays of their invariant functions. This map will be used to access the
  // invariant functions for each Rendezvous contract afterwards.
  const rendezvousInvariantFunctions = filterInvariantFunctions(
    rendezvousAllFunctions
  );

  // The Rendezvous identifier is the first one in the list. Only one contract
  // can be fuzzed at a time.
  const rendezvousContractId = rendezvousList[0];

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
    reporter(runDetails, radio, "invariant");
  };

  fc.assert(
    fc.property(
      fc
        .record({
          // The target contract identifier. It is a constant value equal
          // to the first contract in the list. The arbitrary is still needed,
          // being used for reporting purposes in `heatstroke.ts`.
          rendezvousContractId: fc.constant(rendezvousContractId),
          sutCaller: fc.constantFrom(...eligibleAccounts.entries()),
          invariantCaller: fc.constantFrom(...eligibleAccounts.entries()),
          canMineBlocks: fc.boolean(),
        })
        .chain((r) =>
          fc
            .record({
              selectedFunction: fc.constantFrom(...functions),
              selectedInvariant: fc.constantFrom(...invariants),
            })
            .map((selectedFunctions) => ({ ...r, ...selectedFunctions }))
        )
        .chain((r) =>
          fc
            .record({
              functionArgsArb: fc.tuple(
                ...functionToArbitrary(
                  r.selectedFunction,
                  simnetAddresses,
                  projectTraitImplementations
                )
              ),
              invariantArgsArb: fc.tuple(
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
      (r) => {
        const selectedFunctionArgs = argsToCV(
          r.selectedFunction,
          r.functionArgsArb
        );
        const selectedInvariantArgs = argsToCV(
          r.selectedInvariant,
          r.invariantArgsArb
        );

        const printedFunctionArgs = r.functionArgsArb
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

        const [sutCallerWallet, sutCallerAddress] = r.sutCaller;

        try {
          const { result: functionCallResult } = simnet.callPublicFn(
            r.rendezvousContractId,
            r.selectedFunction.name,
            selectedFunctionArgs,
            sutCallerAddress
          );

          const functionCallResultJson = cvToJSON(functionCallResult);

          if (functionCallResultJson.success) {
            localContext[r.rendezvousContractId][r.selectedFunction.name]++;

            simnet.callPublicFn(
              r.rendezvousContractId,
              "update-context",
              [
                Cl.stringAscii(r.selectedFunction.name),
                Cl.uint(
                  localContext[r.rendezvousContractId][r.selectedFunction.name]
                ),
              ],
              simnet.deployer
            );

            radio.emit(
              "logMessage",
              `₿ ${simnet.burnBlockHeight.toString().padStart(8)} ` +
                `Ӿ ${simnet.blockHeight.toString().padStart(8)}   ` +
                dim(`${sutCallerWallet}        `) +
                `${targetContractName} ` +
                `${underline(r.selectedFunction.name)} ` +
                printedFunctionArgs
            );
          } else {
            radio.emit(
              "logMessage",
              dim(
                `₿ ${simnet.burnBlockHeight.toString().padStart(8)} ` +
                  `Ӿ ${simnet.blockHeight.toString().padStart(8)}   ` +
                  `${sutCallerWallet}        ` +
                  `${targetContractName} ` +
                  `${underline(r.selectedFunction.name)} ` +
                  printedFunctionArgs
              )
            );
          }
        } catch (error: any) {
          // If the function call fails with a runtime error, log a dimmed
          // message. Since the public function result is ignored, there's
          // no need to throw an error.
          radio.emit(
            "logMessage",
            dim(
              `₿ ${simnet.burnBlockHeight.toString().padStart(8)} ` +
                `Ӿ ${simnet.blockHeight.toString().padStart(8)}   ` +
                `${sutCallerWallet}        ` +
                `${targetContractName} ` +
                `${underline(r.selectedFunction.name)} ` +
                printedFunctionArgs
            )
          );
        }

        const printedInvariantArgs = r.invariantArgsArb
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
            selectedInvariantArgs,
            invariantCallerAddress
          );

          const invariantCallResultJson = cvToJSON(invariantCallResult);

          if (invariantCallResultJson.value === true) {
            radio.emit(
              "logMessage",
              `₿ ${simnet.burnBlockHeight.toString().padStart(8)} ` +
                `Ӿ ${simnet.blockHeight.toString().padStart(8)}   ` +
                `${dim(invariantCallerWallet)} ` +
                `${green("[PASS]")} ` +
                `${targetContractName} ` +
                `${underline(r.selectedInvariant.name)} ` +
                printedInvariantArgs
            );
          }

          if (!invariantCallResultJson.value) {
            throw new Error(
              `Invariant failed for ${targetContractName} contract: "${r.selectedInvariant.name}" returned ${invariantCallResultJson.value}`
            );
          }
        } catch (error: any) {
          // Handle both negative results from the invariant function and
          // general runtime failures. Focus is on capturing the invariant
          // function's result, including any runtime errors it caused.
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
        (f) => f.access === "read_only" && f.name.startsWith("invariant-")
      ),
    ])
  );
