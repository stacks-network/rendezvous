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
            ` ✔  ${testCallerWallet} ${r.testContractId.split(".")[1]} ${
              r.selectedTestFunction.name
            } ${printedTestFunctionArgs}`
          );
        } else {
          radio.emit(
            "logMessage",
            ` ✗  ${testCallerWallet} ${r.testContractId.split(".")[1]} ${
              r.selectedTestFunction.name
            } ${printedTestFunctionArgs}`
          );
          throw new Error(
            `Test failed for ${r.testContractId.split(".")[1]} contract: "${
              r.selectedTestFunction.name
            }" returned ${testFunctionCallResultJson.value.value}`
          );
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
