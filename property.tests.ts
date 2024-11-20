import { initSimnet } from "@hirosystems/clarinet-sdk";
import {
  buildTestBundleData,
  deployTestContract,
  deriveTestContractName,
  filterTestContractsInterfaces,
  getTestsContractSource,
  isParamsMatch,
  isReturnTypeBoolean,
  isTestDiscardedInPlace,
} from "./property";
import {
  getSimnetContractSource,
  getSimnetDeployerContractsInterfaces,
} from "./shared";
import { resolve } from "path";
import fs from "fs";
import fc from "fast-check";
import {
  ContractInterfaceFunction,
  ContractInterfaceFunctionAccess,
  ContractInterfaceFunctionArg,
  ContractInterfaceFunctionOutput,
} from "@hirosystems/clarinet-sdk-wasm";
import { cvToJSON } from "@stacks/transactions";

describe("File stream operations", () => {
  it("retrieves the test contract source", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "./example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const expectedTestContractSources = sutContractsList.map((contractId) => {
      const testContractName = `${contractId.split(".")[1]}.tests`;
      const testContractPath = `${contractsPath}/${testContractName}.clar`;
      return fs.readFileSync(testContractPath).toString();
    });

    // Act
    const actualTestContractSources = sutContractsList.map((contractId) =>
      getTestsContractSource(contractsPath, contractId)
    );

    // Assert
    expect(actualTestContractSources).toEqual(expectedTestContractSources);
  });
});

describe("Test contract name operations", () => {
  it("derives the test contract name", () => {
    const addressCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const contractNameCharset =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    fc.assert(
      // Arrange
      fc.property(
        fc.stringOf(fc.constantFrom(...addressCharset)),
        fc.stringOf(fc.constantFrom(...contractNameCharset)),
        (address, contractName) => {
          // Act
          const actual = deriveTestContractName(`${address}.${contractName}`);
          // Assert
          const expected = `${contractName}_tests`;
          expect(actual).toBe(expected);
        }
      )
    );
  });
});

describe("Simnet contracts operations", () => {
  it("retrieves test contracts data", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "./example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());

    const expectedTestContractsData = sutContractsList.map((contractId) => {
      const sutContractSource = getSimnetContractSource(simnet, contractId);
      const testsContractSource = getTestsContractSource(
        contractsPath,
        contractId
      );
      const testBundleContractSource = `${sutContractSource}\n\n${testsContractSource}`;
      const testBundleContractName = deriveTestContractName(contractId);

      return {
        testBundleContractName,
        testBundleContractSource,
        testBundleContractId: `${simnet.deployer}.${testBundleContractName}`,
      };
    });

    // Act
    const actualTestsContractsData = sutContractsList.map((contractId) =>
      buildTestBundleData(simnet, contractId, contractsPath)
    );

    // Assert
    expect(actualTestsContractsData).toEqual(expectedTestContractsData);
  });

  it("deploys test contracts to the simnet", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "./example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const testContractsData = sutContractsList.map((contractId) =>
      buildTestBundleData(simnet, contractId, contractsPath)
    );

    // Act
    testContractsData.forEach((contractData) => {
      deployTestContract(
        simnet,
        contractData.testBundleContractName,
        contractData.testBundleContractSource
      );
    });

    // Re-fetch contract interfaces to check after deployment.
    const actualSimnetContractsInterfacesAfterDeploy =
      getSimnetDeployerContractsInterfaces(simnet);
    const actualSimnetContractsListAfterDeploy = Array.from(
      actualSimnetContractsInterfacesAfterDeploy.keys()
    );

    // Assert
    // Check if all expected test contracts are present in the result.
    testContractsData.forEach((contractData) => {
      expect(actualSimnetContractsListAfterDeploy).toContain(
        contractData.testBundleContractId
      );
    });

    // Ensure there are exactly double the number of
    // original contracts (pre-deployment and test).
    expect(actualSimnetContractsListAfterDeploy).toHaveLength(
      2 * sutContractsList.length
    );
  });

  it("correctly filters the test contracts interfaces", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "./example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const testContractsData = sutContractsList.map((contractId) =>
      buildTestBundleData(simnet, contractId, contractsPath)
    );
    const expectedTestContractsList = testContractsData
      .map((contractData) => {
        deployTestContract(
          simnet,
          contractData.testBundleContractName,
          contractData.testBundleContractSource
        );
        return contractData.testBundleContractId;
      })
      .sort();

    // Act
    const testContractsInterfaces = filterTestContractsInterfaces(
      getSimnetDeployerContractsInterfaces(simnet)
    );
    const actualTestContractsList = Array.from(
      testContractsInterfaces.keys()
    ).sort();

    // Assert
    expect(actualTestContractsList).toEqual(expectedTestContractsList);
  });
});

describe("Test discarding related operations", () => {
  it("boolean output checker returns true when the function's output is boolean", () => {
    fc.assert(
      fc.property(
        fc.record({
          fnName: fc.string(),
          access: fc.constant("read_only"),
          args: fc.array(
            fc.record({
              name: fc.string(),
              type: fc.constantFrom("int128", "uint128", "bool", "principal"),
            })
          ),
          outputs: fc.record({ type: fc.constant("bool") }),
        }),
        (r: {
          fnName: string;
          access: string;
          args: { name: string; type: string }[];
          outputs: { type: string };
        }) => {
          const discardFunctionInterface: ContractInterfaceFunction = {
            name: r.fnName,
            access: r.access as ContractInterfaceFunctionAccess,
            args: r.args as ContractInterfaceFunctionArg[],
            outputs: r.outputs as ContractInterfaceFunctionOutput,
          };
          const actual = isReturnTypeBoolean(discardFunctionInterface);
          expect(actual).toBe(true);
        }
      )
    );
  });

  it("boolean output checker returns false when the function's output is non-boolean", () => {
    fc.assert(
      fc.property(
        fc.record({
          fnName: fc.string(),
          access: fc.constant("read_only"),
          args: fc.array(
            fc.record({
              name: fc.string(),
              type: fc.constantFrom("int128", "uint128", "bool", "principal"),
            })
          ),
          outputs: fc.record({
            type: fc.constantFrom("int128", "uint128", "principal"),
          }),
        }),
        (r: {
          fnName: string;
          access: string;
          args: { name: string; type: string }[];
          outputs: { type: string };
        }) => {
          const discardFunctionInterface: ContractInterfaceFunction = {
            name: r.fnName,
            access: r.access as ContractInterfaceFunctionAccess,
            args: r.args as ContractInterfaceFunctionArg[],
            outputs: r.outputs as ContractInterfaceFunctionOutput,
          };
          const actual = isReturnTypeBoolean(discardFunctionInterface);
          expect(actual).toBe(false);
        }
      )
    );
  });

  it("param matcher returns true when two functions have the same parameters", () => {
    fc.assert(
      fc.property(
        fc.record({
          fnName: fc.string(),
          access: fc.constant("read_only"),
          args: fc.array(
            fc.record({
              name: fc.string(),
              type: fc.constantFrom("int128", "uint128", "bool", "principal"),
            })
          ),
          outputs: fc.record({ type: fc.constant("bool") }),
        }),
        (r: {
          fnName: string;
          access: string;
          args: { name: string; type: string }[];
          outputs: { type: string };
        }) => {
          const testFunctionInterface: ContractInterfaceFunction = {
            name: r.fnName,
            access: r.access as ContractInterfaceFunctionAccess,
            args: r.args as ContractInterfaceFunctionArg[],
            outputs: r.outputs as ContractInterfaceFunctionOutput,
          };
          const discardFunctionInterface: ContractInterfaceFunction = {
            name: r.fnName,
            access: r.access as ContractInterfaceFunctionAccess,
            args: r.args as ContractInterfaceFunctionArg[],
            outputs: r.outputs as ContractInterfaceFunctionOutput,
          };
          const actual = isParamsMatch(
            testFunctionInterface,
            discardFunctionInterface
          );
          expect(actual).toBe(true);
        }
      )
    );
  });

  it("param matcher returns false when two functions have different parameters", () => {
    fc.assert(
      fc.property(
        fc
          .record({
            testFn: fc.record({
              fnName: fc.string(),
              access: fc.constant("read_only"),
              args: fc.array(
                fc.record({
                  name: fc.string(),
                  type: fc.constantFrom(
                    "int128",
                    "uint128",
                    "bool",
                    "principal"
                  ),
                })
              ),
              outputs: fc.record({ type: fc.constant("bool") }),
            }),
            discardFn: fc.record({
              fnName: fc.string(),
              access: fc.constant("read_only"),
              args: fc.array(
                fc.record({
                  name: fc.string(),
                  type: fc.constantFrom(
                    "int128",
                    "uint128",
                    "bool",
                    "principal"
                  ),
                })
              ),
              outputs: fc.record({ type: fc.constant("bool") }),
            }),
          })
          .filter(
            (r) =>
              JSON.stringify(
                [...r.testFn.args].sort((a, b) => a.name.localeCompare(b.name))
              ) !==
              JSON.stringify(
                [...r.discardFn.args].sort((a, b) =>
                  a.name.localeCompare(b.name)
                )
              )
          ),
        (r: {
          testFn: {
            fnName: string;
            access: string;
            args: { name: string; type: string }[];
            outputs: { type: string };
          };
          discardFn: {
            fnName: string;
            access: string;
            args: { name: string; type: string }[];
            outputs: { type: string };
          };
        }) => {
          const testFunctionInterface: ContractInterfaceFunction = {
            name: r.testFn.fnName,
            access: r.testFn.access as ContractInterfaceFunctionAccess,
            args: r.testFn.args as ContractInterfaceFunctionArg[],
            outputs: r.testFn.outputs as ContractInterfaceFunctionOutput,
          };
          const discardFunctionInterface: ContractInterfaceFunction = {
            name: r.discardFn.fnName,
            access: r.discardFn.access as ContractInterfaceFunctionAccess,
            args: r.discardFn.args as ContractInterfaceFunctionArg[],
            outputs: r.discardFn.outputs as ContractInterfaceFunctionOutput,
          };
          const actual = isParamsMatch(
            testFunctionInterface,
            discardFunctionInterface
          );
          expect(actual).toBe(false);
        }
      )
    );
  });

  it("in place discard function returns true if the function call result is (ok false)", async () => {
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");

    const simnet = await initSimnet(manifestPath);

    simnet.deployContract(
      "contract",
      "(define-public (discarded-fn) (ok false))",
      { clarityVersion: 2 },
      simnet.deployer
    );

    const { result: functionCallResult } = simnet.callPublicFn(
      "contract",
      "discarded-fn",
      [],
      simnet.deployer
    );

    const functionCallResultJson = cvToJSON(functionCallResult);

    // Act
    const dircardedInPlace = isTestDiscardedInPlace(functionCallResultJson);

    // Assert
    expect(dircardedInPlace).toBe(true);
  });

  it("in place discard function returns false if the function call result is (ok true)", async () => {
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");

    const simnet = await initSimnet(manifestPath);

    simnet.deployContract(
      "contract",
      "(define-public (not-discarded-fn) (ok true))",
      { clarityVersion: 2 },
      simnet.deployer
    );

    const { result: functionCallResult } = simnet.callPublicFn(
      "contract",
      "not-discarded-fn",
      [],
      simnet.deployer
    );

    const functionCallResultJson = cvToJSON(functionCallResult);

    // Act
    const dircardedInPlace = isTestDiscardedInPlace(functionCallResultJson);

    // Assert
    expect(dircardedInPlace).toBe(false);
  });
});
