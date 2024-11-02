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
  getSimnetDeployerContractsInterfaces,
} from "./shared";
import { green, red, yellow } from "ansicolor";

export const checkProperties = (
  simnet: Simnet,
  contractsPath: string,
  sutContractName: string,
  sutContractIds: string[],
  seed: number | undefined,
  path: string | undefined,
  radio: EventEmitter
) => {
  const testData = sutContractIds.map((contractId) =>
    buildTestData(simnet, contractId, contractsPath)
  );

  const testContractsList = testData.map((contractData) => {
    deployTestContract(
      simnet,
      contractData.testContractName,
      contractData.testsContractSource
    );
    return contractData.testsContractId;
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

  // Search for preliminary functions, for each test function. This map will
  // be used to pair the test functions with their corresponding preliminary
  // functions.
  const testContractsPreliminaryFunctions = new Map(
    Array.from(testContractsAllFunctions, ([contractId, functions]) => [
      contractId,
      functions.filter(
        (f) => f.access === "read_only" && f.name.startsWith("can-")
      ),
    ])
  );

  // Pair each test function with its corresponding preliminary function. When
  // a test function is selected, Rendezvous will first call its preliminary
  // function, if available, to validate that the generated test arguments are
  // meaningful. This way, we are reducing the risk of false positives in test
  // results.
  const testContractsPairedFunctions = new Map(
    Array.from(testContractsTestFunctions, ([contractId, functions]) => [
      contractId,
      new Map(
        functions.map((f) => {
          const preliminaryFunction = testContractsPreliminaryFunctions
            .get(contractId)
            ?.find((pf) => pf.name === `can-${f.name}`);

          return [f.name, preliminaryFunction?.name];
        })
      ),
    ])
  );

  let preliminaryFunctionError = false;

  // If preliminary functions are available, verify they follow the remaining rules:
  // - Their parameters must match those of the test function.
  // - Their return type must be boolean.
  testContractsPairedFunctions.forEach((pairedMap, contractId) => {
    pairedMap.forEach((preliminaryFunctionName, testFunctionName) => {
      if (preliminaryFunctionName) {
        const testFunction = testContractsTestFunctions
          .get(contractId)
          ?.find((f) => f.name === testFunctionName);
        const preliminaryFunction = testContractsPreliminaryFunctions
          .get(contractId)
          ?.find((f) => f.name === preliminaryFunctionName);

        if (testFunction && preliminaryFunction) {
          const paramsMatch =
            JSON.stringify(testFunction.args) ===
            JSON.stringify(preliminaryFunction.args);
          const returnTypeIsBoolean =
            preliminaryFunction.outputs.type === "bool";

          if (!paramsMatch) {
            radio.emit(
              "logFailure",
              red(
                `\n[FAIL] Parameter mismatch for preliminary function "${preliminaryFunctionName}" in contract "${deriveTestContractName(
                  sutContractIds[0]
                )}".`
              )
            );
            preliminaryFunctionError = true;
            return;
          }
          if (!returnTypeIsBoolean) {
            radio.emit(
              "logFailure",
              red(
                `\n[FAIL] Return type must be boolean for preliminary function "${preliminaryFunctionName}" in contract "${deriveTestContractName(
                  sutContractIds[0]
                )}".`
              )
            );
            preliminaryFunctionError = true;
            return;
          }
        }
      }
    });
  });

  if (preliminaryFunctionError) {
    return;
  }

  const radioReporter = (runDetails: any) => {
    reporter(runDetails, radio, "test");
  };

  fc.assert(
    fc.property(
      fc
        .record({
          testContractId: fc.constantFrom(...testContractsList),
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

        const preliminaryFunctionName = testContractsPairedFunctions
          .get(r.testContractId)!
          .get(r.selectedTestFunction.name);

        let discarded = false;

        // If a preliminary function is defined, call it first to determine if
        // the test function can be executed. If the preliminary function call
        // returns false, we will still call the test function but emit a log
        // that the test was discarded.
        if (preliminaryFunctionName !== undefined) {
          const { result: preliminaryFunctionCallResult } =
            simnet.callReadOnlyFn(
              r.testContractId,
              preliminaryFunctionName,
              selectedTestFunctionArgs,
              testCallerAddress
            );

          const jsonPreliminaryFunctionCallResult = cvToJSON(
            preliminaryFunctionCallResult
          );

          discarded = jsonPreliminaryFunctionCallResult.value === false;
        }

        if (discarded) {
          radio.emit(
            "logMessage",
            ` ${yellow("[WARN]")}  ${testCallerWallet} ${
              r.testContractId.split(".")[1]
            } ${
              r.selectedTestFunction.name
            } ${printedTestFunctionArgs} (discarded)`
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
              ` ${green("[PASS]")}  ${testCallerWallet} ${
                r.testContractId.split(".")[1]
              } ${r.selectedTestFunction.name} ${printedTestFunctionArgs}`
            );
          } else {
            radio.emit(
              "logMessage",
              ` ${red("[FAIL]")}  ${testCallerWallet} ${
                r.testContractId.split(".")[1]
              } ${r.selectedTestFunction.name} ${printedTestFunctionArgs}`
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
    { verbose: true, reporter: radioReporter, seed: seed, path: path }
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
 * Build the test contract data.
 * @param simnet The simnet instance.
 * @param contractId The contract identifier.
 * @param contractsPath The contracts path.
 * @returns The test contract data representing an object. The returned object
 * contains the test contract name, the test contract source code, and the test
 * contract identifier. This data is used to deploy the test contract to the
 * simnet in a later step.
 */
export const buildTestData = (
  simnet: Simnet,
  contractId: string,
  contractsPath: string
) => {
  const testContractName = deriveTestContractName(contractId);

  try {
    const testsContractSource = getTestsContractSource(
      contractsPath,
      contractId
    );

    return {
      testContractName,
      testsContractSource,
      testsContractId: `${simnet.deployer}.${testContractName}`,
    };
  } catch (e: any) {
    throw new Error(
      `Error processing test contract ${testContractName}: ${e.message}`
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
