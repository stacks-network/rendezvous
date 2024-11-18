import { Simnet } from "@hirosystems/clarinet-sdk";
import { EventEmitter } from "events";
import {
  argsToCV,
  functionToArbitrary,
  getFunctionsFromContractInterfaces,
  getFunctionsListForContract,
  getSimnetContractSource,
  getSimnetDeployerContractsInterfaces,
} from "./shared";
import { LocalContext } from "./invariant.types";
import { Cl, cvToJSON } from "@stacks/transactions";
import { reporter } from "./heatstroke";
import { join } from "path";
import fc from "fast-check";
import fs from "fs";
import { dim, green, inverse, red, underline } from "ansicolor";
import {
  ContractInterfaceFunction,
  IContractInterface,
} from "@hirosystems/clarinet-sdk-wasm";

export const checkInvariants = (
  simnet: Simnet,
  contractsPath: string,
  sutContractName: string,
  sutContractIds: string[],
  seed: number | undefined,
  path: string | undefined,
  runs: number | undefined,
  radio: EventEmitter
) => {
  const rendezvousList = sutContractIds
    .map((contractId) => buildRendezvousData(simnet, contractId, contractsPath))
    .map((contractData) => {
      deployRendezvous(
        simnet,
        contractData.rendezvousName,
        contractData.rendezvousSource
      );
      return contractData.rendezvousContractId;
    });

  const rendezvousAllFunctions = getFunctionsFromContractInterfaces(
    filterRendezvousInterfaces(getSimnetDeployerContractsInterfaces(simnet))
  );

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

  // Set up local context to track SUT function call counts.
  const localContext = initializeLocalContext(rendezvousSutFunctions);

  // Set up context in simnet by initializing state for SUT.
  initializeClarityContext(simnet, rendezvousSutFunctions);

  radio.emit(
    "logMessage",
    `\nStarting invariant testing type for the ${sutContractName} contract...`
  );

  const radioReporter = (runDetails: any) => {
    reporter(runDetails, radio, "invariant");
  };

  fc.assert(
    fc.property(
      fc
        .record({
          rendezvousContractId: fc.constantFrom(...rendezvousList),
          sutCaller: fc.constantFrom(
            ...new Map(
              [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
            ).entries()
          ),
          invariantCaller: fc.constantFrom(
            ...new Map(
              [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
            ).entries()
          ),
        })
        .chain((r) => {
          const functions = getFunctionsListForContract(
            rendezvousSutFunctions,
            r.rendezvousContractId
          );
          const invariantFunctions = getFunctionsListForContract(
            rendezvousInvariantFunctions,
            r.rendezvousContractId
          );

          if (functions?.length === 0) {
            throw new Error(
              `No public functions found for the "${getContractNameFromRendezvousId(
                r.rendezvousContractId
              )}" contract.`
            );
          }
          if (invariantFunctions?.length === 0) {
            throw new Error(
              `No invariant functions found for the "${getContractNameFromRendezvousId(
                r.rendezvousContractId
              )}" contract. Beware, for your contract may be exposed to unforeseen issues.`
            );
          }
          const functionArbitrary = fc.constantFrom(
            ...(functions as ContractInterfaceFunction[])
          );
          // FIXME: For invariants, we have to be able to select a random
          // number of them (zero or more).
          const invariantFunctionArbitrary = fc.constantFrom(
            ...(invariantFunctions as ContractInterfaceFunction[])
          );

          return fc
            .record({
              selectedFunction: functionArbitrary,
              selectedInvariant: invariantFunctionArbitrary,
            })
            .map((selectedFunctions) => ({ ...r, ...selectedFunctions }));
        })
        .chain((r) => {
          const functionArgsArb = functionToArbitrary(
            r.selectedFunction,
            Array.from(simnet.getAccounts().values())
          );

          const invariantArgsArb = functionToArbitrary(
            r.selectedInvariant,
            Array.from(simnet.getAccounts().values())
          );

          return fc
            .record({
              functionArgsArb: fc.tuple(...functionArgsArb),
              invariantArgsArb: fc.tuple(...invariantArgsArb),
            })
            .map((args) => ({ ...r, ...args }));
        }),
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
              `       ${dim(sutCallerWallet)} ${getContractNameFromRendezvousId(
                r.rendezvousContractId
              )} ${underline(r.selectedFunction.name)} ${printedFunctionArgs}`
            );
          } else {
            radio.emit(
              "logMessage",
              dim(
                `       ${sutCallerWallet} ${getContractNameFromRendezvousId(
                  r.rendezvousContractId
                )} ${underline(r.selectedFunction.name)} ${printedFunctionArgs}`
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
              `       ${sutCallerWallet} ${getContractNameFromRendezvousId(
                r.rendezvousContractId
              )} ${underline(r.selectedFunction.name)} ${printedFunctionArgs}`
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
              `${green("[PASS]")} ${dim(
                invariantCallerWallet
              )} ${getContractNameFromRendezvousId(
                r.rendezvousContractId
              )} ${underline(r.selectedInvariant.name)} ${printedInvariantArgs}`
            );
          }

          if (!invariantCallResultJson.value) {
            throw new Error(
              `Invariant failed for ${getContractNameFromRendezvousId(
                r.rendezvousContractId
              )} contract: "${r.selectedInvariant.name}" returned ${
                invariantCallResultJson.value
              }`
            );
          }
        } catch (error: any) {
          // Handle both negative results from the invariant function and
          // general runtime failures. Focus is on capturing the invariant
          // function's result, including any runtime errors it caused.
          radio.emit(
            "logMessage",
            `${red(
              "[FAIL]"
            )} ${invariantCallerWallet} ${getContractNameFromRendezvousId(
              r.rendezvousContractId
            )} ${underline(r.selectedInvariant.name)} ${printedInvariantArgs}`
          );

          // Re-throw the error for fast-check to catch and process.
          throw error;
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
 * Get the invariant contract source code.
 * @param contractsPath The contracts path.
 * @param sutContractId The corresponding contract identifier.
 * @returns The invariant contract source code.
 */
export const getInvariantContractSource = (
  contractsPath: string,
  sutContractId: string
) => {
  // FIXME: Here, we can encounter a failure if the contract file name is
  // not the same as the contract name in the manifest.
  // Example:
  // - Contract name in the manifest: [contracts.counter-xyz]
  // - Contract file name: path = "contracts/counter.clar"
  const invariantContractName = `${
    sutContractId.split(".")[1]
  }.invariants.clar`;
  const invariantContractPath = join(contractsPath, invariantContractName);
  try {
    return fs.readFileSync(invariantContractPath).toString();
  } catch (e: any) {
    throw new Error(
      `Error retrieving the corresponding invariant contract for the "${
        sutContractId.split(".")[1]
      }" contract. ${e.message}`
    );
  }
};

/**
 * Schedule a Rendezvous between the System Under Test (`SUT`) and the
 * invariants.
 * @param contract The SUT contract source code.
 * @param invariants The invariants contract source code.
 * @returns The Rendezvous source code.
 */
export function scheduleRendezvous(
  contract: string,
  invariants: string
): string {
  /**
   * The context is like the secret sauce for a successful rendez-vous. It can
   * totally change the conversation from "meh" to "wow" and set the mood for
   * a legendary chat. Handle with care!
   */
  const context = `(define-map context (string-ascii 100) {
    called: uint
    ;; other data
  })

  (define-public (update-context (function-name (string-ascii 100)) (called uint))
    (ok (map-set context function-name {called: called})))`;

  return `${contract}\n\n${context}\n\n${invariants}`;
}

/**
 * Derive the Rendezvous name.
 * @param contractId The contract identifier.
 * @returns The Rendezvous name.
 */
export const deriveRendezvousName = (contractId: string) =>
  `${contractId.split(".")[1]}_rendezvous`;

/**
 * Build the Rendezvous data.
 * @param simnet The simnet instance.
 * @param contractId The contract identifier.
 * @param contractsPath The contracts path.
 * @returns The Rendezvous data representing an object. The returned object
 * contains the Rendezvous name, the Rendezvous source code, and the Rendezvous
 * contract identifier. This data is used to deploy the Rendezvous to the simnet
 * in a later step.
 */
export const buildRendezvousData = (
  simnet: Simnet,
  contractId: string,
  contractsPath: string
) => {
  try {
    const sutContractSource = getSimnetContractSource(simnet, contractId);
    const invariantContractSource = getInvariantContractSource(
      contractsPath,
      contractId
    );
    const rendezvousSource = scheduleRendezvous(
      sutContractSource!,
      invariantContractSource
    );
    const rendezvousName = deriveRendezvousName(contractId);

    return {
      rendezvousName,
      rendezvousSource,
      rendezvousContractId: `${simnet.deployer}.${rendezvousName}`,
    };
  } catch (e: any) {
    throw new Error(
      `Error processing contract ${contractId.split(".")[1]}: ${e.message}`
    );
  }
};

/**
 * Deploy the Rendezvous to the simnet.
 * @param simnet The simnet instance.
 * @param rendezvousName The Rendezvous name.
 * @param rendezvousSource The Rendezvous source code.
 */
export const deployRendezvous = (
  simnet: Simnet,
  rendezvousName: string,
  rendezvousSource: string
) => {
  try {
    simnet.deployContract(
      rendezvousName,
      rendezvousSource,
      { clarityVersion: 2 },
      simnet.deployer
    );
  } catch (e: any) {
    throw new Error(
      `Something went wrong. Please double check the invariants contract: ${rendezvousName.replace(
        "_rendezvous",
        ""
      )}.invariant.clar:\n${e}`
    );
  }
};

/**
 * Filter the Rendezvous interfaces from the contracts interfaces map.
 * @param contractsInterfaces The contracts interfaces map.
 * @returns The Rendezvous interfaces.
 */
export const filterRendezvousInterfaces = (
  contractsInterfaces: Map<string, IContractInterface>
) =>
  new Map(
    Array.from(contractsInterfaces).filter(([contractId]) =>
      contractId.endsWith("_rendezvous")
    )
  );

/**
 * Initialize the local context, setting the number of times each function
 * has been called to zero.
 * @param rendezvousSutFunctions The Rendezvous functions.
 * @returns The initialized local context.
 */
export const initializeLocalContext = (
  rendezvousSutFunctions: Map<string, ContractInterfaceFunction[]>
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
  rendezvousSutFunctions: Map<string, ContractInterfaceFunction[]>
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
 * Get the contract name from the Rendezvous identifier.
 * @param rendezvousId The Rendezvous contract identifier.
 * @returns The contract name.
 */
export const getContractNameFromRendezvousId = (rendezvousId: string) =>
  rendezvousId.split(".")[1].replace("_rendezvous", "");

/**
 * Filter the System Under Test (`SUT`) functions from the map of all
 * contract functions.
 *
 * The SUT functions are the ones that have `public` access since they are
 * capable of changing the contract state.
 * @param allFunctionsMap The map containing all the functions for each contract.
 * @returns A map containing only the SUT functions for each contract.
 */
const filterSutFunctions = (
  allFunctionsMap: Map<string, ContractInterfaceFunction[]>
) =>
  new Map(
    Array.from(allFunctionsMap, ([contractId, functions]) => [
      contractId,
      functions.filter(
        (f) => f.access === "public" && f.name !== "update-context"
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
