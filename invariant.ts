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
  isTraitReferenceFunction,
} from "./traits";
import { EnrichedContractInterfaceFunction } from "./shared.types";

export const checkInvariants = (
  simnet: Simnet,
  sutContractName: string,
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

  // The Rendezvous identifier is the first one in the list. Only one contract
  // can be fuzzed at a time.
  const rendezvousContractId = rendezvousList[0];

  const traitReferenceSutFunctions = rendezvousSutFunctions
    .get(rendezvousContractId)!
    .filter((fn) => isTraitReferenceFunction(fn));

  const enrichedSutFunctionsInterfaces =
    traitReferenceSutFunctions.length > 0
      ? enrichInterfaceWithTraitData(
          simnet.getContractAST(sutContractName),
          buildTraitReferenceMap(
            rendezvousSutFunctions.get(rendezvousContractId)!
          ),
          rendezvousSutFunctions.get(rendezvousContractId)!,
          rendezvousContractId
        )
      : rendezvousSutFunctions;

  // A map where the keys are the Rendezvous identifiers and the values are
  // arrays of their invariant functions. This map will be used to access the
  // invariant functions for each Rendezvous contract afterwards.
  const rendezvousInvariantFunctions = filterInvariantFunctions(
    rendezvousAllFunctions
  );

  const traitReferenceInvariantFunctions = rendezvousInvariantFunctions
    .get(rendezvousContractId)!
    .filter((fn) => isTraitReferenceFunction(fn));

  const enrichedInvariantFunctionsInterfaces =
    traitReferenceInvariantFunctions.length > 0
      ? enrichInterfaceWithTraitData(
          simnet.getContractAST(sutContractName),
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
    `\nStarting invariant testing type for the ${sutContractName} contract...\n`
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

  const invariantFunctions = getFunctionsListForContract(
    enrichedInvariantFunctionsInterfaces,
    rendezvousContractId
  );

  if (functions?.length === 0) {
    radio.emit(
      "logMessage",
      red(
        `No public functions found for the "${sutContractName}" contract. Without public functions, no state transitions can happen inside the contract, and the invariant test is not meaningful.\n`
      )
    );
    return;
  }

  if (invariantFunctions?.length === 0) {
    radio.emit(
      "logMessage",
      red(
        `No invariant functions found for the "${sutContractName}" contract. Beware, for your contract may be exposed to unforeseen issues.\n`
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
              selectedInvariant: fc.constantFrom(...invariantFunctions),
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
                  simnet
                )
              ),
              invariantArgsArb: fc.tuple(
                ...functionToArbitrary(
                  r.selectedInvariant,
                  simnetAddresses,
                  simnet
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
                `${sutContractName} ` +
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
                  `${sutContractName} ` +
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
                `${sutContractName} ` +
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
                `${sutContractName} ` +
                `${underline(r.selectedInvariant.name)} ` +
                printedInvariantArgs
            );
          }

          if (!invariantCallResultJson.value) {
            throw new Error(
              `Invariant failed for ${sutContractName} contract: "${r.selectedInvariant.name}" returned ${invariantCallResultJson.value}`
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
                `${sutContractName} ` +
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
 * Initialize the local context, setting the number of times each function
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
 * Filter the System Under Test (`SUT`) functions from the map of all
 * contract functions.
 *
 * The SUT functions are the ones that have `public` access since they are
 * capable of changing the contract state, and they are not test functions.
 * @param allFunctionsMap The map containing all the functions for each
 * contract.
 * @returns A map containing only the SUT functions for each contract.
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
