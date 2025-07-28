import { Simnet } from "@hirosystems/clarinet-sdk";
import { EventEmitter } from "events";
import fc from "fast-check";
import { cvToJSON, cvToString } from "@stacks/transactions";
import { reporter } from "./heatstroke";
import {
  argsToCV,
  functionToArbitrary,
  getContractNameFromContractId,
  getFunctionsListForContract,
} from "./shared";
import { dim, green, red, underline, yellow } from "ansicolor";
import { ContractInterfaceFunction } from "@hirosystems/clarinet-sdk-wasm";
import {
  buildTraitReferenceMap,
  enrichInterfaceWithTraitData,
  extractProjectTraitImplementations,
  isTraitReferenceFunction,
} from "./traits";

/**
 * Runs property-based tests on the target contract and logs the progress.
 * Reports the test results through a custom reporter.
 * @param simnet The simnet instance.
 * @param targetContractName The name of the target contract.
 * @param rendezvousList The list of contract IDs for each target contract.
 * @param rendezvousAllFunctions A map of all target contract IDs to their
 * function interfaces.
 * @param seed The seed for reproducible property-based tests.
 * @param path The path for reproducible property-based tests.
 * @param runs The number of test runs.
 * @param bail Stop execution after the first failure and prevent further
 * shrinking.
 * @param radio The custom logging event emitter.
 * @returns void
 */
export const checkProperties = (
  simnet: Simnet,
  targetContractName: string,
  rendezvousList: string[],
  rendezvousAllFunctions: Map<string, ContractInterfaceFunction[]>,
  seed: number | undefined,
  path: string | undefined,
  runs: number | undefined,
  bail: boolean,
  radio: EventEmitter
) => {
  const testContractId = rendezvousList[0];

  // A map where the keys are the test contract identifiers and the values are
  // arrays of their test functions. This map will be used to access the test
  // functions for each test contract in the property-based testing routine.
  const testContractsTestFunctions = filterTestFunctions(
    rendezvousAllFunctions
  );

  const traitReferenceFunctions = testContractsTestFunctions
    .get(testContractId)!
    .filter((fn) => isTraitReferenceFunction(fn));

  const projectTraitImplementations =
    extractProjectTraitImplementations(simnet);

  if (
    Object.entries(projectTraitImplementations).length === 0 &&
    traitReferenceFunctions.length > 0
  ) {
    radio.emit(
      "logMessage",
      red(
        `\nFound test functions referencing traits, but no trait implementations were found in the project.
\nNote: You can add contracts implementing traits either as project contracts or as Clarinet requirements. For more details, visit: https://www.hiro.so/clarinet/.
\n`
      )
    );
    return;
  }

  const enrichedTestFunctionsInterfaces =
    traitReferenceFunctions.length > 0
      ? enrichInterfaceWithTraitData(
          simnet.getContractAST(targetContractName),
          buildTraitReferenceMap(
            testContractsTestFunctions.get(testContractId)!
          ),
          testContractsTestFunctions.get(testContractId)!,
          testContractId
        )
      : testContractsTestFunctions;

  radio.emit(
    "logMessage",
    `\nStarting property testing type for the ${targetContractName} contract...\n`
  );

  // Search for discard functions, for each test function. This map will
  // be used to pair the test functions with their corresponding discard
  // functions.
  const testContractsDiscardFunctions = new Map(
    Array.from(rendezvousAllFunctions, ([contractId, functions]) => [
      contractId,
      functions.filter(
        ({ access, name }) => access === "read_only" && name.startsWith("can-")
      ),
    ])
  );

  // Pair each test function with its corresponding discard function. When a
  // test function is selected, Rendezvous will first call its discard
  // function, to allow or prevent the property test from running.
  const testContractsPairedFunctions = new Map(
    Array.from(testContractsTestFunctions, ([contractId, functions]) => [
      contractId,
      new Map(
        functions.map((f) => {
          const discardFunction = testContractsDiscardFunctions
            .get(contractId)
            ?.find((pf) => pf.name === `can-${f.name}`);

          return [f.name, discardFunction?.name];
        })
      ),
    ])
  );

  const hasDiscardFunctionErrors = Array.from(
    testContractsPairedFunctions
  ).some(([contractId, pairedMap]) =>
    Array.from(pairedMap).some(([testFunctionName, discardFunctionName]) =>
      discardFunctionName
        ? !validateDiscardFunction(
            contractId,
            discardFunctionName,
            testFunctionName,
            testContractsDiscardFunctions,
            testContractsTestFunctions,
            radio
          )
        : false
    )
  );

  if (hasDiscardFunctionErrors) {
    return;
  }

  const simnetAccounts = simnet.getAccounts();

  const eligibleAccounts = new Map(
    [...simnetAccounts].filter(([key]) => key !== "faucet")
  );

  const simnetAddresses = Array.from(simnetAccounts.values());

  const testFunctions = getFunctionsListForContract(
    enrichedTestFunctionsInterfaces,
    testContractId
  );

  if (testFunctions?.length === 0) {
    radio.emit(
      "logMessage",
      red(`No test functions found for the "${targetContractName}" contract.\n`)
    );
    return;
  }

  const radioReporter = (runDetails: any) => {
    reporter(runDetails, radio, "test");
  };

  fc.assert(
    fc.property(
      fc
        .record({
          testContractId: fc.constant(testContractId),
          testCaller: fc.constantFrom(...eligibleAccounts.entries()),
          canMineBlocks: fc.boolean(),
        })
        .chain((r) =>
          fc
            .record({
              selectedTestFunction: fc.constantFrom(...testFunctions),
            })
            .map((selectedTestFunction) => ({
              ...r,
              ...selectedTestFunction,
            }))
        )
        .chain((r) =>
          fc
            .record({
              functionArgs: fc.tuple(
                ...functionToArbitrary(
                  r.selectedTestFunction,
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
        const selectedTestFunctionArgs = argsToCV(
          r.selectedTestFunction,
          r.functionArgs
        );

        const printedTestFunctionArgs = r.functionArgs
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

        const [testCallerWallet, testCallerAddress] = r.testCaller;

        const discardFunctionName = testContractsPairedFunctions
          .get(r.testContractId)!
          .get(r.selectedTestFunction.name);

        const discarded = isTestDiscarded(
          discardFunctionName,
          selectedTestFunctionArgs,
          r.testContractId,
          simnet,
          testCallerAddress
        );

        if (discarded) {
          radio.emit(
            "logMessage",
            `₿ ${simnet.burnBlockHeight.toString().padStart(8)} ` +
              `Ӿ ${simnet.blockHeight.toString().padStart(8)}   ` +
              `${dim(testCallerWallet)} ` +
              `${yellow("[WARN]")} ` +
              `${targetContractName} ` +
              `${underline(r.selectedTestFunction.name)} ` +
              dim(printedTestFunctionArgs)
          );
        } else {
          try {
            // If the function call results in a runtime error, the error will
            // be caught and logged as a test failure in the catch block.
            const { result: testFunctionCallResult } = simnet.callPublicFn(
              r.testContractId,
              r.selectedTestFunction.name,
              selectedTestFunctionArgs,
              testCallerAddress
            );

            const testFunctionCallResultJson = cvToJSON(testFunctionCallResult);

            const discardedInPlace = isTestDiscardedInPlace(
              testFunctionCallResultJson
            );

            const testFunctionCallClarityResult = cvToString(
              testFunctionCallResult
            );

            if (discardedInPlace) {
              radio.emit(
                "logMessage",
                `₿ ${simnet.burnBlockHeight.toString().padStart(8)} ` +
                  `Ӿ ${simnet.blockHeight.toString().padStart(8)}   ` +
                  `${dim(testCallerWallet)} ` +
                  `${yellow("[WARN]")} ` +
                  `${targetContractName} ` +
                  `${underline(r.selectedTestFunction.name)} ` +
                  `${dim(printedTestFunctionArgs)} ` +
                  yellow(testFunctionCallClarityResult)
              );
            } else if (
              !discardedInPlace &&
              testFunctionCallResultJson.success &&
              testFunctionCallResultJson.value.value === true
            ) {
              radio.emit(
                "logMessage",
                `₿ ${simnet.burnBlockHeight.toString().padStart(8)} ` +
                  `Ӿ ${simnet.blockHeight.toString().padStart(8)}   ` +
                  `${dim(testCallerWallet)} ` +
                  `${green("[PASS]")} ` +
                  `${targetContractName} ` +
                  `${underline(r.selectedTestFunction.name)} ` +
                  `${printedTestFunctionArgs} ` +
                  green(testFunctionCallClarityResult)
              );

              if (r.canMineBlocks) {
                simnet.mineEmptyBurnBlocks(r.burnBlocks);
              }
            } else {
              // The function call did not result in (ok true) or (ok false).
              // Either the test failed or the test function returned an
              // unexpected value i.e. `(ok 1)`.
              throw new PropertyTestError(
                `Test failed for ${targetContractName} contract: "${r.selectedTestFunction.name}" returned ${testFunctionCallClarityResult}`,
                testFunctionCallClarityResult
              );
            }
          } catch (error: any) {
            const displayedError =
              error instanceof PropertyTestError
                ? error.clarityError
                : error &&
                  typeof error === "string" &&
                  error.toLowerCase().includes("runtime")
                ? "(runtime)"
                : "(unknown)";

            // Capture the error and log the test failure.
            radio.emit(
              "logMessage",
              red(
                `₿ ${simnet.burnBlockHeight.toString().padStart(8)} ` +
                  `Ӿ ${simnet.blockHeight.toString().padStart(8)}   ` +
                  `${testCallerWallet} ` +
                  `[FAIL] ` +
                  `${targetContractName} ` +
                  `${underline(r.selectedTestFunction.name)} ` +
                  `${printedTestFunctionArgs} ` +
                  displayedError
              )
            );

            // Re-throw the error for fast-check to catch and process.
            throw error;
          }
        }
      }
    ),
    {
      endOnFailure: bail,
      numRuns: runs,
      path: path,
      reporter: radioReporter,
      seed: seed,
      verbose: true,
    }
  );
};

const filterTestFunctions = (
  allFunctionsMap: Map<string, ContractInterfaceFunction[]>
) =>
  new Map(
    Array.from(allFunctionsMap, ([contractId, functions]) => [
      contractId,
      functions.filter(
        (f) => f.access === "public" && f.name.startsWith("test-")
      ),
    ])
  );

export const isTestDiscardedInPlace = (testFunctionCallResultJson: any) =>
  testFunctionCallResultJson.success === true &&
  testFunctionCallResultJson.value.value === false;

/**
 * Checks if the test function has to be discarded.
 * @param discardFunctionName The discard function name.
 * @param selectedTestFunctionArgs The generated test function arguments.
 * @param contractId The contract identifier.
 * @param simnet The simnet instance.
 * @param selectedCaller The selected caller address.
 * @returns A boolean indicating if the test function has to be discarded.
 */
const isTestDiscarded = (
  discardFunctionName: string | undefined,
  selectedTestFunctionArgs: any[],
  contractId: string,
  simnet: Simnet,
  selectedCaller: string
) => {
  if (!discardFunctionName) return false;

  const { result: discardFunctionCallResult } = simnet.callReadOnlyFn(
    contractId,
    discardFunctionName,
    selectedTestFunctionArgs,
    selectedCaller
  );
  const jsonDiscardFunctionCallResult = cvToJSON(discardFunctionCallResult);
  return jsonDiscardFunctionCallResult.value === false;
};

/**
 * Validates a discard function, ensuring that its parameters match the test
 * function's parameters and that its return type is boolean.
 * @param contractId The contract identifier.
 * @param discardFunctionName The discard function name.
 * @param testFunctionName The test function name.
 * @param testContractsDiscardFunctions The discard functions map.
 * @param testContractsTestFunctions The test functions map.
 * @param radio The radio event emitter.
 * @returns A boolean indicating if the discard function passes the checks.
 */
const validateDiscardFunction = (
  contractId: string,
  discardFunctionName: string,
  testFunctionName: string,
  testContractsDiscardFunctions: Map<string, ContractInterfaceFunction[]>,
  testContractsTestFunctions: Map<string, ContractInterfaceFunction[]>,
  radio: EventEmitter
) => {
  const testFunction = testContractsTestFunctions
    .get(contractId)
    ?.find((f) => f.name === testFunctionName);
  const discardFunction = testContractsDiscardFunctions
    .get(contractId)
    ?.find((f) => f.name === discardFunctionName);

  if (!testFunction || !discardFunction) return false;

  if (!isParamsMatch(testFunction, discardFunction)) {
    radio.emit(
      "logMessage",
      red(
        `\nError: Parameter mismatch for discard function "${discardFunctionName}" in contract "${getContractNameFromContractId(
          contractId
        )}".\n`
      )
    );
    return false;
  }

  if (!isReturnTypeBoolean(discardFunction)) {
    radio.emit(
      "logMessage",
      red(
        `\nError: Return type must be boolean for discard function "${discardFunctionName}" in contract "${getContractNameFromContractId(
          contractId
        )}".\n`
      )
    );
    return false;
  }

  return true;
};

/**
 * Checks if the test function parameters match the discard function
 * parameters.
 * @param testFunctionInterface The test function's interface.
 * @param discardFunctionInterface The discard function's interface.
 * @returns A boolean indicating if the parameters match.
 */
export const isParamsMatch = (
  testFunctionInterface: ContractInterfaceFunction,
  discardFunctionInterface: ContractInterfaceFunction
) => {
  const sortedTestFunctionArgs = [...testFunctionInterface.args].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const sortedDiscardFunctionArgs = [...discardFunctionInterface.args].sort(
    (a, b) => a.name.localeCompare(b.name)
  );
  return (
    JSON.stringify(sortedTestFunctionArgs) ===
    JSON.stringify(sortedDiscardFunctionArgs)
  );
};

/**
 * Checks if the discard function's return type is boolean.
 * @param discardFunctionInterface The discard function's interface.
 * @returns A boolean indicating if the return type is boolean.
 */
export const isReturnTypeBoolean = (
  discardFunctionInterface: ContractInterfaceFunction
) => discardFunctionInterface.outputs.type === "bool";

class PropertyTestError extends Error {
  readonly clarityError: string;
  constructor(message: string, clarityError: string) {
    super(message);
    this.clarityError = clarityError;
  }
}
