import { initSimnet } from "@hirosystems/clarinet-sdk";
import {
  buildTestData,
  deployTestContract,
  deriveTestContractName,
  filterTestContractsInterfaces,
  getTestsContractSource,
} from "../property";
import { getSimnetDeployerContractsInterfaces } from "../shared";
import { resolve } from "path";
import fs from "fs";
import fc from "fast-check";

describe("File stream operations", () => {
  it("retrieves the test contract source", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "../example/contracts");
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
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "../example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());

    const expectedTestContractsData = sutContractsList.map((contractId) => {
      const testContractName = deriveTestContractName(contractId);

      const testsContractSource = getTestsContractSource(
        contractsPath,
        contractId
      );

      return {
        testContractName,
        testsContractSource,
        testsContractId: `${simnet.deployer}.${testContractName}`,
      };
    });

    // Act
    const actualTestsContractsData = sutContractsList.map((contractId) =>
      buildTestData(simnet, contractId, contractsPath)
    );

    // Assert
    expect(actualTestsContractsData).toEqual(expectedTestContractsData);
  });

  it("deploys test contracts to the simnet", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "../example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const testContractsData = sutContractsList.map((contractId) =>
      buildTestData(simnet, contractId, contractsPath)
    );

    // Act
    testContractsData.forEach((contractData) => {
      deployTestContract(
        simnet,
        contractData.testContractName,
        contractData.testsContractSource
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
        contractData.testsContractId
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
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "../example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const testContractsData = sutContractsList.map((contractId) =>
      buildTestData(simnet, contractId, contractsPath)
    );
    const expectedTestContractsList = testContractsData
      .map((contractData) => {
        deployTestContract(
          simnet,
          contractData.testContractName,
          contractData.testsContractSource
        );
        return contractData.testsContractId;
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
