import { Simnet } from "@hirosystems/clarinet-sdk";
import { EventEmitter } from "events";
import { join } from "path";
import fs from "fs";
import fc from "fast-check";
import {
  ContractInterface,
  ContractInterfaceFunction,
} from "@hirosystems/clarinet-sdk/dist/esm/contractInterface";
import { cvToJSON } from "@stacks/transactions";
import { reporter } from "./heatstroke";
import {
  argsToCV,
  functionToArbitrary,
  getFunctionsFromContractInterfaces,
  getFunctionsListForContract,
  getSimnetContractSource,
  getSimnetDeployerContractsInterfaces,
} from "./shared";
import { dim, green, red, underline, yellow } from "ansicolor";

export const checkProperties = (
  simnet: Simnet,
  contractsPath: string,
  sutContractName: string,
  sutContractIds: string[],
  seed: number | undefined,
  path: string | undefined,
  runs: number | undefined,
  radio: EventEmitter
) => {
  const testContractBundlesList = sutContractIds
    .map((contractId) => buildTestBundleData(simnet, contractId, contractsPath))
    .map((contractData) => {
      deployTestContract(
        simnet,
        contractData.testBundleContractName,
        contractData.testBundleContractSource
      );
      return contractData.testBundleContractId;
    });

  const testContractsInterfaces = filterTestContractsInterfaces(
    getSimnetDeployerContractsInterfaces(simnet)
  );

  const testContractsAllFunctions = getFunctionsFromContractInterfaces(
    testContractsInterfaces
  );

  // A map where the keys are the test contract identifiers and the values are
  // arrays of their test functions. This map will be used to access the test
  // functions for each test contract in the property-based testing routine.
  const testContractsTestFunctions = filterTestFunctions(
    testContractsAllFunctions
  );

  radio.emit(
    "logMessage",
    `\nStarting property testing type for the ${sutContractName} contract...`
  );

  // Search for discard functions, for each test function. This map will
  // be used to pair the test functions with their corresponding discard
  // functions.
  const testContractsDiscardFunctions = new Map(
    Array.from(testContractsAllFunctions, ([contractId, functions]) => [
      contractId,
      functions.filter(
        (f) => f.access === "read_only" && f.name.startsWith("can-")
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

  const radioReporter = (runDetails: any) => {
    reporter(runDetails, radio, "test");
  };

  fc.assert(
    fc.property(
      fc
        .record({
          testContractId: fc.constantFrom(...testContractBundlesList),
          testCaller: fc.constantFrom(
            ...new Map(
              [...simnet.getAccounts()].filter(([key]) => key !== "faucet")
            ).entries()
          ),
        })
        .chain((r) => {
          const testFunctionsList = getFunctionsListForContract(
            testContractsTestFunctions,
            r.testContractId
          );

          if (testFunctionsList?.length === 0) {
            throw new Error(
              `No test functions found for the "${sutContractName}" contract.`
            );
          }
          const testFunctionArbitrary = fc.constantFrom(
            ...(testFunctionsList as ContractInterfaceFunction[])
          );

          return fc
            .record({
              selectedTestFunction: testFunctionArbitrary,
            })
            .map((selectedTestFunction) => ({
              ...r,
              ...selectedTestFunction,
            }));
        })
        .chain((r) => {
          const functionArgsArb = functionToArbitrary(
            r.selectedTestFunction,
            Array.from(simnet.getAccounts().values())
          );

          return fc
            .record({
              functionArgsArb: fc.tuple(...functionArgsArb),
            })
            .map((args) => ({ ...r, ...args }));
        }),
      (r) => {
        const selectedTestFunctionArgs = argsToCV(
          r.selectedTestFunction,
          r.functionArgsArb
        );

        const printedTestFunctionArgs = r.functionArgsArb
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
            `${yellow("[WARN]")} ${dim(testCallerWallet)} ${
              r.testContractId.split(".")[1]
            } ${underline(r.selectedTestFunction.name)} ${dim(
              printedTestFunctionArgs
            )}`
          );
        } else {
          const { result: testFunctionCallResult } = simnet.callPublicFn(
            r.testContractId,
            r.selectedTestFunction.name,
            selectedTestFunctionArgs,
            testCallerAddress
          );

          const testFunctionCallResultJson = cvToJSON(testFunctionCallResult);

          if (
            testFunctionCallResultJson.success &&
            testFunctionCallResultJson.value.value === true
          ) {
            radio.emit(
              "logMessage",
              `${green("[PASS]")} ${dim(testCallerWallet)} ${
                r.testContractId.split(".")[1]
              } ${underline(
                r.selectedTestFunction.name
              )} ${printedTestFunctionArgs}`
            );
          } else {
            radio.emit(
              "logMessage",
              `${red("[FAIL]")} ${dim(testCallerWallet)} ${
                r.testContractId.split(".")[1]
              } ${underline(
                r.selectedTestFunction.name
              )} ${printedTestFunctionArgs}`
            );
            throw new Error(
              `Test failed for ${r.testContractId.split(".")[1]} contract: "${
                r.selectedTestFunction.name
              }" returned ${testFunctionCallResultJson.value.value}`
            );
          }
        }
      }
    ),
    { verbose: true, reporter: radioReporter, seed: seed, path: path, numRuns: runs }
  );
};

/**
 * Derive the test contract name.
 * @param contractId The contract identifier.
 * @returns The test contract name.
 */
export const deriveTestContractName = (contractId: string) =>
  `${contractId.split(".")[1]}_tests`;

/**
 * Get the tests contract source code.
 * @param contractsPath The contracts path.
 * @param sutContractId The corresponding contract identifier.
 * @returns The tests contract source code.
 */
export const getTestsContractSource = (
  contractsPath: string,
  sutContractId: string
) => {
  // FIXME: Here, we can encounter a failure if the contract file name does
  // not match the contract name in the manifest.
  // Example:
  // - Contract name in the manifest: [contracts.counter-xyz]
  // - Contract file name: path = "contracts/counter.clar"
  const testsContractName = `${sutContractId.split(".")[1]}.tests.clar`;
  const testsContractPath = join(contractsPath, testsContractName);
  try {
    return fs.readFileSync(testsContractPath).toString();
  } catch (e: any) {
    throw new Error(
      `Error retrieving the test contract for the "${
        sutContractId.split(".")[1]
      }" contract. ${e.message}`
    );
  }
};

/**
 * Build the test bundle data. The test bundle is the combination of the sut
 * and its corresponding property-based tests contract.
 * @param simnet The simnet instance.
 * @param contractId The contract identifier.
 * @param contractsPath The contracts path.
 * @returns The test bundle data representing an object. The returned object
 * contains the test bundle name, the test bundle source code, and the test
 * bundle identifier. This data is used to deploy the test bundle to the
 * simnet in a later step.
 */
export const buildTestBundleData = (
  simnet: Simnet,
  contractId: string,
  contractsPath: string
) => {
  try {
    const sutContractSource = getSimnetContractSource(simnet, contractId);
    const testsContractSource = getTestsContractSource(
      contractsPath,
      contractId
    );
    const testBundleContractSource = `${sutContractSource}\n\n${testsContractSource}`;
    const testBundleContractName = deriveTestContractName(contractId);

    // In property testing, the SUT contract and its test contract are bundled
    // together. Unlike invariants with rendezvous "data" (context), test bundle
    // does not have such a context.
    return {
      testBundleContractName,
      testBundleContractSource,
      testBundleContractId: `${simnet.deployer}.${testBundleContractName}`,
    };
  } catch (e: any) {
    throw new Error(
      `Error processing contract ${contractId.split(".")[1]}: ${e.message}`
    );
  }
};

/**
 * Deploy the test contract to the simnet.
 * @param simnet The simnet instance.
 * @param testContractName The test contract name.
 * @param testContractSource The test contract source code.
 */
export const deployTestContract = (
  simnet: Simnet,
  testContractName: string,
  testContractSource: string
) => {
  try {
    simnet.deployContract(
      testContractName,
      testContractSource,
      { clarityVersion: 2 },
      simnet.deployer
    );
  } catch (e: any) {
    throw new Error(
      `Something went wrong. Please double check the tests contract: ${testContractName.replace(
        "_tests",
        ""
      )}.tests.clar:\n${e}`
    );
  }
};

/**
 * Filter the test contracts interfaces from the contracts interfaces map.
 * @param contractsInterfaces The contracts interfaces map.
 * @returns The test contracts interfaces.
 */
export const filterTestContractsInterfaces = (
  contractsInterfaces: Map<string, ContractInterface>
) =>
  new Map(
    Array.from(contractsInterfaces).filter(([contractId]) =>
      contractId.endsWith("_tests")
    )
  );

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

/**
 * Check if the test function has to be discarded.
 * @param discardFunctionName The discard function name.
 * @param selectedTestFunctionArgs The generated test function arguments.
 * @param contractId The contract identifier.
 * @param simnet The simnet instance.
 * @param selectedCaller The selected caller.
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
 * Validate the discard function, ensuring that its parameters match the test
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
      "logFailure",
      red(
        `\nError: Parameter mismatch for discard function "${discardFunctionName}" in contract "${
          contractId.split(".")[1]
        }".\n`
      )
    );
    return false;
  }

  if (!isReturnTypeBoolean(discardFunction)) {
    radio.emit(
      "logFailure",
      red(
        `\nError: Return type must be boolean for discard function "${discardFunctionName}" in contract "${
          contractId.split(".")[1]
        }".\n`
      )
    );
    return false;
  }

  return true;
};

/**
 * Verify if the test function parameters match the discard function
 * parameters.
 * @param testFunction The test function's interface.
 * @param discardFunction The discard function's interface.
 * @returns A boolean indicating if the parameters match.
 */
export const isParamsMatch = (
  testFunction: ContractInterfaceFunction,
  discardFunction: ContractInterfaceFunction
) => {
  const sortedTestFunctionArgs = [...testFunction.args].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const sortedDiscardFunctionArgs = [...discardFunction.args].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return (
    JSON.stringify(sortedTestFunctionArgs) ===
    JSON.stringify(sortedDiscardFunctionArgs)
  );
};

/**
 * Verify if the discard function's return type is boolean.
 * @param discardFunction The discard function's interface.
 * @returns A boolean indicating if the return type is boolean.
 */
export const isReturnTypeBoolean = (
  discardFunction: ContractInterfaceFunction
) => discardFunction.outputs.type === "bool";
