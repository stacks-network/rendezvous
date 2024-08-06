import { initSimnet } from "@hirosystems/clarinet-sdk";
import {
  contexatenate,
  deployConcatenatedContract,
  generateAllConcatContractsData,
  generateConcatContractName,
  getInvariantContractSource,
  getSimnetContractSource,
  getSimnetDeployerContractsInterfaces,
  main,
} from "../app";
import fc from "fast-check";
import fs from "fs";
import path from "path";

describe("Manifest handling", () => {
  it("throws error when manifest path is not provided", () => {
    expect(async () => await main()).rejects.toThrow(
      "No path to Clarinet.toml manifest provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities."
    );
  });
});

describe("Contract concatenation", () => {
  const context = `(define-map context (string-ascii 100) {
    called: uint
    ;; other data
  })

  (define-public (update-context (function-name (string-ascii 100)) (called uint))
    (ok (map-set context function-name {called: called})))`;

  it("adds context between contract and invariants", () => {
    fc.assert(
      // Arrange
      fc.property(fc.string(), fc.string(), (contract, invariants) => {
        // Act
        const actual = contexatenate(contract, invariants);
        // Assert
        const expected = `${contract}\n\n${context}\n\n${invariants}`;
        expect(actual).toBe(expected);
      })
    );
  });

  it("generates concatenated contract name", () => {
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
          const actual = generateConcatContractName(
            `${address}.${contractName}`
          );
          // Assert
          const expected = `${contractName}_concat`;
          expect(actual).toBe(expected);
        }
      )
    );
  });
});

describe("File stream operations", () => {
  it("retrieves the invariant contract source", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const contractsPath = path.resolve(__dirname, "contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const expectedInvariantContractSources = sutContractsList.map(
      (contractName) => {
        const invariantContractName = `${
          contractName.split(".")[1]
        }.invariants`;
        const invariantContractPath = `${contractsPath}/${invariantContractName}.clar`;
        return fs.readFileSync(invariantContractPath).toString();
      }
    );

    // Act
    const actualInvariantContractSources = sutContractsList.map(
      (contractName) => getInvariantContractSource(contractsPath, contractName)
    );

    // Assert
    expect(actualInvariantContractSources).toEqual(
      expectedInvariantContractSources
    );
  });
});

describe("Simnet contracts operations", () => {
  // FIXME: We can have multiple manifest paths and randomly select one.
  // For now, we'll use the one we have.
  it("retrieves the contracts from the simnet", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const expectedDeployerContracts = new Map(
      Array.from(simnet.getContractsInterfaces()).filter(
        ([key]) => key.split(".")[0] === simnet.deployer
      )
    );

    // Act
    const actualDeployerContracts =
      getSimnetDeployerContractsInterfaces(simnet);

    // Assert
    expect(actualDeployerContracts).toEqual(expectedDeployerContracts);
  });

  it("retrieves the contract source from the simnet", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());

    const expectedContractSources = sutContractsList.map((contractName) =>
      simnet.getContractSource(contractName)
    );

    // Act
    const actualContractSources = sutContractsList.map((contractName) =>
      getSimnetContractSource(simnet, contractName)
    );

    // Assert
    expect(actualContractSources).toEqual(expectedContractSources);
  });

  it("retrieves concatenated contracts data", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const contractsPath = path.resolve(__dirname, "contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());

    const expectedConcatContractsData = sutContractsList.map((contractName) => {
      const sutContractSource = getSimnetContractSource(simnet, contractName);
      const invariantContractSource = getInvariantContractSource(
        contractsPath,
        contractName
      );
      const concatContractSource = contexatenate(
        sutContractSource!,
        invariantContractSource
      );
      const concatContractName = generateConcatContractName(contractName);

      return {
        concatContractName,
        concatContractSource,
        fullContractName: `${simnet.deployer}.${concatContractName}`,
      };
    });

    // Act
    const actualConcatContractsData = generateAllConcatContractsData(
      simnet,
      sutContractsList,
      contractsPath
    );

    // Assert
    expect(actualConcatContractsData).toEqual(expectedConcatContractsData);
  });

  it("deploys concatenated contracts to the simnet", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const contractsPath = path.resolve(__dirname, "contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const concatContractsData = generateAllConcatContractsData(
      simnet,
      sutContractsList,
      contractsPath
    );

    // Act
    concatContractsData.forEach((contractData) => {
      deployConcatenatedContract(
        simnet,
        contractData.concatContractName,
        contractData.concatContractSource
      );
    });

    // Re-fetch contract interfaces to check after deployment
    const actualSimnetContractsInterfacesAfterDeploy =
      getSimnetDeployerContractsInterfaces(simnet);
    const actualSimnetContractsListAfterDeploy = Array.from(
      actualSimnetContractsInterfacesAfterDeploy.keys()
    );

    // Assert
    // Check if all expected concatenated contracts are present in the result
    concatContractsData.forEach((contractData) => {
      expect(actualSimnetContractsListAfterDeploy).toContain(
        contractData.fullContractName
      );
    });

    // Ensure there are exactly double the number of original contracts (pre-deployment and concatenated)
    expect(actualSimnetContractsListAfterDeploy).toHaveLength(
      2 * sutContractsList.length
    );
  });
});
