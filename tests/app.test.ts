import { initSimnet } from "@hirosystems/clarinet-sdk";
import {
  contexatenate,
  deployConcatenatedContract,
  filterConcatenatedContractsInterfaces,
  buildConcatenatedContractData,
  generateConcatenatedContractName,
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
          const actual = generateConcatenatedContractName(
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

  it("retrieves concatenated contracts data", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const contractsPath = path.resolve(__dirname, "contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());

    const expectedConcatenatedContractsData = sutContractsList.map(
      (contractName) => {
        const sutContractSource = getSimnetContractSource(simnet, contractName);
        const invariantContractSource = getInvariantContractSource(
          contractsPath,
          contractName
        );
        const concatenatedContractSource = contexatenate(
          sutContractSource!,
          invariantContractSource
        );
        const concatenatedContractName =
          generateConcatenatedContractName(contractName);

        return {
          concatenatedContractName: concatenatedContractName,
          concatenatedContractSource: concatenatedContractSource,
          fullContractName: `${simnet.deployer}.${concatenatedContractName}`,
        };
      }
    );

    // Act
    const actualconcatenatedContractsData = sutContractsList.map(
      (contractName) =>
        buildConcatenatedContractData(simnet, contractName, contractsPath)
    );

    // Assert
    expect(actualconcatenatedContractsData).toEqual(
      expectedConcatenatedContractsData
    );
  });

  it("deploys concatenated contracts to the simnet", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const contractsPath = path.resolve(__dirname, "contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const concatenatedContractsData = sutContractsList.map((contractName) =>
      buildConcatenatedContractData(simnet, contractName, contractsPath)
    );

    // Act
    concatenatedContractsData.forEach((contractData) => {
      deployConcatenatedContract(
        simnet,
        contractData.concatenatedContractName,
        contractData.concatenatedContractSource
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
    concatenatedContractsData.forEach((contractData) => {
      expect(actualSimnetContractsListAfterDeploy).toContain(
        contractData.fullContractName
      );
    });

    // Ensure there are exactly double the number of original contracts (pre-deployment and concatenated)
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

  it("correctly filters the concatenated contracts interfaces", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const contractsPath = path.resolve(__dirname, "contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const concatenatedContractsData = sutContractsList.map((contractName) =>
      buildConcatenatedContractData(simnet, contractName, contractsPath)
    );
    concatenatedContractsData.forEach((contractData) => {
      deployConcatenatedContract(
        simnet,
        contractData.concatenatedContractName,
        contractData.concatenatedContractSource
      );
    });
    const expectedconcatenatedContractsList = concatenatedContractsData.map(
      (contractData) => contractData.fullContractName
    );

    // Act
    const concatenatedContractsInterfaces =
      filterConcatenatedContractsInterfaces(
        getSimnetDeployerContractsInterfaces(simnet)
      );
    const actualconcatenatedContractsList = Array.from(
      concatenatedContractsInterfaces.keys()
    );

    // Assert
    expect(actualconcatenatedContractsList).toEqual(
      expectedconcatenatedContractsList
    );
  });

  it("correctly initializes the Clarity context", async () => {
    // Arrange
    const manifestPath = path.resolve(__dirname, "Clarinet.toml");
    const contractsPath = path.resolve(__dirname, "contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const concatenatedContractsData = sutContractsList.map((contractName) =>
      buildConcatenatedContractData(simnet, contractName, contractsPath)
    );
    concatenatedContractsData.forEach((contractData) => {
      deployConcatenatedContract(
        simnet,
        contractData.concatenatedContractName,
        contractData.concatenatedContractSource
      );
    });
    const concatenatedContractsInterfaces =
      filterConcatenatedContractsInterfaces(
        getSimnetDeployerContractsInterfaces(simnet)
      );
    const concatenatedContractsAllFunctions =
      getFunctionsFromContractInterfaces(concatenatedContractsInterfaces);

    // The JS representation of Clarity `(some (tuple (called uint)))`, where `called` is
    // initialized to 0.
    const expectedClarityValue = Cl.some(Cl.tuple({ called: Cl.uint(0) }));
    const expectedContext = Array.from(
      concatenatedContractsAllFunctions
    ).flatMap(([contractName, functions]) =>
      functions.map((f) => {
        return {
          contractName,
          functionName: f.name,
          called: expectedClarityValue,
        };
      })
    );

    // Act
    initializeClarityContext(simnet, concatenatedContractsAllFunctions);

    const actualContext = Array.from(concatenatedContractsAllFunctions).flatMap(
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
