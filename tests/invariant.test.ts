import { initSimnet } from "@hirosystems/clarinet-sdk";
import {
  buildRendezvousData,
  deployRendezvous,
  deriveRendezvousName,
  filterRendezvousInterfaces,
  getContractNameFromRendezvousId,
  getInvariantContractSource,
  getSimnetContractSource,
  initializeClarityContext,
  initializeLocalContext,
  scheduleRendezvous,
} from "../invariant";
import {
  getFunctionsFromContractInterfaces,
  getSimnetDeployerContractsInterfaces,
} from "../shared";
import { resolve } from "path";
import fs from "fs";
import fc from "fast-check";
import { Cl } from "@stacks/transactions";

describe("File stream operations", () => {
  it("retrieves the invariant contract source", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "../example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const expectedInvariantContractSources = sutContractsList.map(
      (contractId) => {
        const invariantContractName = `${contractId.split(".")[1]}.invariants`;
        const invariantContractPath = `${contractsPath}/${invariantContractName}.clar`;
        return fs.readFileSync(invariantContractPath).toString();
      }
    );

    // Act
    const actualInvariantContractSources = sutContractsList.map((contractId) =>
      getInvariantContractSource(contractsPath, contractId)
    );

    // Assert
    expect(actualInvariantContractSources).toEqual(
      expectedInvariantContractSources
    );
  });
});

describe("Simnet contracts operations", () => {
  it("retrieves Rendezvous contracts data", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "../example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());

    const expectedRendezvousData = sutContractsList.map((contractId) => {
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
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "../example/contracts");
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
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "../example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const rendezvousData = sutContractsList.map((contractId) =>
      buildRendezvousData(simnet, contractId, contractsPath)
    );
    const expectedRendezvousList = rendezvousData
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
    const rendezvousInterfaces = filterRendezvousInterfaces(
      getSimnetDeployerContractsInterfaces(simnet)
    );
    const actualRendezvousList = Array.from(rendezvousInterfaces.keys()).sort();

    // Assert
    expect(actualRendezvousList).toEqual(expectedRendezvousList);
  });

  it("correctly initializes the local context for a given functions map", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsAllFunctions = getFunctionsFromContractInterfaces(
      sutContractsInterfaces
    );

    const expectedInitialContext = Object.fromEntries(
      Array.from(sutContractsAllFunctions.entries()).map(
        ([contractId, functions]) => [
          contractId,
          Object.fromEntries(functions.map((f) => [f.name, 0])),
        ]
      )
    );

    // Act
    const actualInitialContext = initializeLocalContext(
      sutContractsAllFunctions
    );

    // Assert
    expect(actualInitialContext).toEqual(expectedInitialContext);
  });

  it("correctly initializes the Clarity context", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "../example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const rendezvousData = sutContractsList.map((contractId) =>
      buildRendezvousData(simnet, contractId, contractsPath)
    );
    rendezvousData.forEach((contractData) => {
      deployRendezvous(
        simnet,
        contractData.rendezvousName,
        contractData.rendezvousSource
      );
    });
    const rendezvousInterfaces = filterRendezvousInterfaces(
      getSimnetDeployerContractsInterfaces(simnet)
    );
    const rendezvousAllFunctions =
      getFunctionsFromContractInterfaces(rendezvousInterfaces);

    // The JS representation of Clarity `(some (tuple (called uint)))`, where `called` is
    // initialized to 0.
    const expectedClarityValue = Cl.some(Cl.tuple({ called: Cl.uint(0) }));
    const expectedContext = Array.from(rendezvousAllFunctions).flatMap(
      ([contractId, functions]) =>
        functions.map((f) => {
          return {
            contractId,
            functionName: f.name,
            called: expectedClarityValue,
          };
        })
    );

    // Act
    initializeClarityContext(simnet, rendezvousAllFunctions);

    const actualContext = Array.from(rendezvousAllFunctions).flatMap(
      ([contractId, functions]) =>
        functions.map((f) => {
          const actualValue = simnet.getMapEntry(
            contractId,
            "context",
            Cl.stringAscii(f.name)
          );
          return {
            contractId,
            functionName: f.name,
            called: actualValue,
          };
        })
    );

    // Assert
    expect(actualContext).toEqual(expectedContext);
  });

  it("retrieves the contract source from the simnet", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "../example/Clarinet.toml");
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
