import { initSimnet } from "@hirosystems/clarinet-sdk";
import {
  scheduleRendezvous,
  deployRendezvous,
  filterRendezvousInterfaces,
  buildRendezvousData,
  deriveRendezvousName,
  getContractNameFromRendezvousName,
  getFunctionsFromContractInterfaces,
  getFunctionsListForContract,
  getInvariantContractSource,
  getSimnetContractSource,
  getSimnetDeployerContractsInterfaces,
  initializeClarityContext,
  initializeLocalContext,
  main,
} from "../app";
import fc from "fast-check";
import fs from "fs";
import path from "path";
import { Cl } from "@stacks/transactions";

describe("Manifest handling", () => {
  it("throws error when manifest path is not provided", () => {
    expect(async () => await main()).rejects.toThrow(
      "No path to Clarinet project provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities."
    );
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

  it("generates Rendezvous contract name", () => {
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
          const rendezvousName = `${address}.${contractName}_rendezvous`;

          // Act
          const actual = getContractNameFromRendezvousName(rendezvousName);

          // Assert
          expect(actual).toBe(contractName);
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

  it("retrieves the contract functions from the simnet", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const allFunctionsMap = new Map(
      Array.from(
        sutContractsInterfaces,
        ([contractName, contractInterface]) => [
          contractName,
          contractInterface.functions,
        ]
      )
    );
    const expectedContractFunctionsList = sutContractsList.map(
      (contractName) => allFunctionsMap.get(contractName) || []
    );

    // Act
    const actualContractFunctionsList = sutContractsList.map((contractName) =>
      getFunctionsListForContract(allFunctionsMap, contractName)
    );

    // Assert
    expect(actualContractFunctionsList).toEqual(expectedContractFunctionsList);
  });

  it("retrieves Rendezvous contracts data", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const contractsPath = path.resolve(__dirname, "contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());

    const expectedRendezvousData = sutContractsList.map((contractName) => {
      const sutContractSource = getSimnetContractSource(simnet, contractName);
      const invariantContractSource = getInvariantContractSource(
        contractsPath,
        contractName
      );
      const rendezvousSource = scheduleRendezvous(
        sutContractSource!,
        invariantContractSource
      );
      const rendezvousName = deriveRendezvousName(contractName);

      return {
        rendezvousName,
        rendezvousSource,
        fullContractName: `${simnet.deployer}.${rendezvousName}`,
      };
    });

    // Act
    const actualRendezvousData = sutContractsList.map((contractName) =>
      buildRendezvousData(simnet, contractName, contractsPath)
    );

    // Assert
    expect(actualRendezvousData).toEqual(expectedRendezvousData);
  });

  it("deploys Rendezvous contracts to the simnet", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const contractsPath = path.resolve(__dirname, "contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const rendezvousData = sutContractsList.map((contractName) =>
      buildRendezvousData(simnet, contractName, contractsPath)
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
        contractData.fullContractName
      );
    });

    // Ensure there are exactly double the number of original contracts (pre-deployment and Rendezvous)
    expect(actualSimnetContractsListAfterDeploy).toHaveLength(
      2 * sutContractsList.length
    );
  });

  it("extracts the functions from the contract interfaces", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const expectedAllFunctionsMap = new Map(
      Array.from(
        sutContractsInterfaces,
        ([contractName, contractInterface]) => [
          contractName,
          contractInterface.functions,
        ]
      )
    );

    // Act
    const actualAllFunctionsMap = getFunctionsFromContractInterfaces(
      sutContractsInterfaces
    );

    // Assert
    expect(actualAllFunctionsMap).toEqual(expectedAllFunctionsMap);
  });

  it("correctly initializes the local context for a given functions map", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsAllFunctions = getFunctionsFromContractInterfaces(
      sutContractsInterfaces
    );

    const expectedInitialContext = Object.fromEntries(
      Array.from(sutContractsAllFunctions.entries()).map(
        ([contractName, functions]) => [
          contractName,
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

  it("correctly filters the Rendezvous contracts interfaces", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const contractsPath = path.resolve(__dirname, "contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const rendezvousData = sutContractsList.map((contractName) =>
      buildRendezvousData(simnet, contractName, contractsPath)
    );
    const expectedRendezvousList = rendezvousData.map((contractData) => {
      deployRendezvous(
        simnet,
        contractData.rendezvousName,
        contractData.rendezvousSource
      );
      return contractData.fullContractName;
    });

    // Act
    const rendezvousInterfaces = filterRendezvousInterfaces(
      getSimnetDeployerContractsInterfaces(simnet)
    );
    const actualRendezvousList = Array.from(rendezvousInterfaces.keys());

    // Assert
    expect(actualRendezvousList).toEqual(expectedRendezvousList);
  });

  it("correctly initializes the Clarity context", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const contractsPath = path.resolve(__dirname, "contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const rendezvousData = sutContractsList.map((contractName) =>
      buildRendezvousData(simnet, contractName, contractsPath)
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
      ([contractName, functions]) =>
        functions.map((f) => {
          return {
            contractName,
            functionName: f.name,
            called: expectedClarityValue,
          };
        })
    );

    // Act
    initializeClarityContext(simnet, rendezvousAllFunctions);

    const actualContext = Array.from(rendezvousAllFunctions).flatMap(
      ([contractName, functions]) =>
        functions.map((f) => {
          const actualValue = simnet.getMapEntry(
            contractName,
            "context",
            Cl.stringAscii(f.name)
          );
          return { contractName, functionName: f.name, called: actualValue };
        })
    );

    // Assert
    expect(actualContext).toEqual(expectedContext);
  });
});
