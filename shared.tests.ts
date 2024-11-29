import { initSimnet } from "@hirosystems/clarinet-sdk";
import {
  getFunctionsFromContractInterfaces,
  getFunctionsListForContract,
  getSimnetDeployerContractsInterfaces,
  scheduleRendezvous,
} from "./shared";
import { resolve } from "path";
import fc from "fast-check";
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

  // it("retrieves Rendezvous contracts data", async () => {
  //   // Arrange
  //   const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
  //   const contractsPath = resolve(__dirname, "./example/contracts");
  //   const simnet = await initSimnet(manifestPath);
  //   const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
  //   const sutContractsList = Array.from(sutContractsInterfaces.keys());

  //   const expectedRendezvousData = sutContractsList.map((contractId) => {
  //     const sutContractSource = getSimnetContractSource(simnet, contractId);
  //     const invariantContractSource = getTestContractSource(
  //       contractsPath,
  //       contractId
  //     );
  //     const rendezvousSource = scheduleRendezvous(
  //       sutContractSource!,
  //       invariantContractSource
  //     );

  //     return {
  //       rendezvousFileName: deriveRendezvousName(contractId),
  //       rendezvousSource,
  //       rendezvousContractId: contractId,
  //       rendezvousContractName: contractId.split(".")[1],
  //     };
  //   });

  //   // Act
  //   const actualRendezvousData = sutContractsList.map((contractId) =>
  //     buildRendezvousData(simnet, contractId, contractsPath)
  //   );

  //   // Assert
  //   expect(actualRendezvousData).toEqual(expectedRendezvousData);
  // });
});

describe("File stream operations", () => {
  // it("retrieves the test contract source", async () => {
  //   // Arrange
  //   const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
  //   const contractsPath = resolve(__dirname, "./example/contracts");
  //   const simnet = await initSimnet(manifestPath);
  //   const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
  //   const sutContractsList = Array.from(sutContractsInterfaces.keys());
  //   const expectedTestContractSources = sutContractsList.map((contractId) => {
  //     const testContractName = `${contractId.split(".")[1]}.tests`;
  //     const testContractPath = `${contractsPath}/${testContractName}.clar`;
  //     return fs.readFileSync(testContractPath).toString();
  //   });
  //   // Act
  //   const actualTestContractSources = sutContractsList.map((contractId) =>
  //     getTestContractSource(contractsPath, contractId)
  //   );
  //   // Assert
  //   expect(actualTestContractSources).toEqual(expectedTestContractSources);
  // });
});

describe("Successfully schedules rendezvous", () => {
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
