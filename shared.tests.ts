import { initSimnet } from "@hirosystems/clarinet-sdk";
import {
  buildRendezvousData,
  deployRendezvous,
  deriveRendezvousName,
  filterRendezvousInterfaces,
  getFunctionsFromContractInterfaces,
  getFunctionsListForContract,
  getSimnetContractSource,
  getSimnetDeployerContractsInterfaces,
  getTestContractSource,
  scheduleRendezvous,
} from "./shared";
import { resolve } from "path";
import fc from "fast-check";
import fs from "fs";
import { getContractNameFromRendezvousId } from "./invariant";

describe("Simnet contracts operations", () => {
  it("retrieves the contracts from the simnet", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
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

  it("retrieves the contract functions from the simnet", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const allFunctionsMap = new Map(
      Array.from(sutContractsInterfaces, ([contractId, contractInterface]) => [
        contractId,
        contractInterface.functions,
      ])
    );
    const expectedContractFunctionsList = sutContractsList.map(
      (contractId) => allFunctionsMap.get(contractId) || []
    );

    // Act
    const actualContractFunctionsList = sutContractsList.map((contractId) =>
      getFunctionsListForContract(allFunctionsMap, contractId)
    );

    // Assert
    expect(actualContractFunctionsList).toEqual(expectedContractFunctionsList);
  });

  it("extracts the functions from the contract interfaces", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const expectedAllFunctionsMap = new Map(
      Array.from(sutContractsInterfaces, ([contractId, contractInterface]) => [
        contractId,
        contractInterface.functions,
      ])
    );

    // Act
    const actualAllFunctionsMap = getFunctionsFromContractInterfaces(
      sutContractsInterfaces
    );

    // Assert
    expect(actualAllFunctionsMap).toEqual(expectedAllFunctionsMap);
  });

  it("retrieves Rendezvous contracts data", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "./example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());

    const expectedRendezvousData = sutContractsList.map((contractId) => {
      const sutContractSource = getSimnetContractSource(simnet, contractId);
      const invariantContractSource = getTestContractSource(
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
    });

    // Act
    const actualRendezvousData = sutContractsList.map((contractId) =>
      buildRendezvousData(simnet, contractId, contractsPath)
    );

    // Assert
    expect(actualRendezvousData).toEqual(expectedRendezvousData);
  });

  it("deploys Rendezvous contracts to the simnet", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "./example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const rendezvousData = sutContractsList.map((contractId) =>
      buildRendezvousData(simnet, contractId, contractsPath)
    );

    // Act
    rendezvousData.forEach((contractData) => {
      deployRendezvous(
        simnet,
        contractData.rendezvousName,
        contractData.rendezvousSource
      );
    });

    // Re-fetch contract interfaces to check after deployment
    const actualSimnetContractsInterfacesAfterDeploy =
      getSimnetDeployerContractsInterfaces(simnet);
    const actualSimnetContractsListAfterDeploy = Array.from(
      actualSimnetContractsInterfacesAfterDeploy.keys()
    );

    // Assert
    // Check if all expected Rendezvous contracts are present in the result
    rendezvousData.forEach((contractData) => {
      expect(actualSimnetContractsListAfterDeploy).toContain(
        contractData.rendezvousContractId
      );
    });

    // Ensure there are exactly double the number of original contracts (pre-deployment and Rendezvous)
    expect(actualSimnetContractsListAfterDeploy).toHaveLength(
      2 * sutContractsList.length
    );
  });

  it("correctly filters the Rendezvous contracts interfaces", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "./example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const expectedRendezvousList = sutContractsList
      .map((contractId) =>
        buildRendezvousData(simnet, contractId, contractsPath)
      )
      .map((contractData) => {
        deployRendezvous(
          simnet,
          contractData.rendezvousName,
          contractData.rendezvousSource
        );
        return contractData.rendezvousContractId;
      })
      .sort();

    // Act
    const actualRendezvousList = Array.from(
      filterRendezvousInterfaces(
        getSimnetDeployerContractsInterfaces(simnet)
      ).keys()
    ).sort();

    // Assert
    expect(actualRendezvousList).toEqual(expectedRendezvousList);
  });

  it("retrieves the contract source from the simnet", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());

    const expectedContractSources = sutContractsList.map((contractId) =>
      simnet.getContractSource(contractId)
    );

    // Act
    const actualContractSources = sutContractsList.map((contractId) =>
      getSimnetContractSource(simnet, contractId)
    );

    // Assert
    expect(actualContractSources).toEqual(expectedContractSources);
  });
});

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
      getTestContractSource(contractsPath, contractId)
    );

    // Assert
    expect(actualTestContractSources).toEqual(expectedTestContractSources);
  });
});

describe("Successfully schedules rendez-vous", () => {
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
        const actual = scheduleRendezvous(contract, invariants);
        // Assert
        const expected = `${contract}\n\n${context}\n\n${invariants}`;
        expect(actual).toBe(expected);
      })
    );
  });

  it("derives the Rendezvous contract name", () => {
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
          const actual = deriveRendezvousName(`${address}.${contractName}`);
          // Assert
          const expected = `${contractName}_rendezvous`;
          expect(actual).toBe(expected);
        }
      )
    );
  });

  it("gets contract name from Rendezvous contract name", () => {
    const addressCharset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const contractNameCharset =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    fc.assert(
      // Arrange
      fc.property(
        fc.stringOf(fc.constantFrom(...addressCharset)),
        fc.stringOf(fc.constantFrom(...contractNameCharset)),
        (address, contractName) => {
          const rendezvousId = `${address}.${contractName}_rendezvous`;

          // Act
          const actual = getContractNameFromRendezvousId(rendezvousId);

          // Assert
          expect(actual).toBe(contractName);
        }
      )
    );
  });
});
