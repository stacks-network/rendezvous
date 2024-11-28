import { initSimnet } from "@hirosystems/clarinet-sdk";
import { initializeClarityContext, initializeLocalContext } from "./invariant";
import {
  buildRendezvousData,
  getFunctionsFromContractInterfaces,
  getSimnetDeployerContractsInterfaces,
  getTestContractSource,
} from "./shared";
import { resolve } from "path";
import fs from "fs";
import { Cl } from "@stacks/transactions";

describe("File stream operations", () => {
  it("retrieves the invariant contract source", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
    const contractsPath = resolve(__dirname, "./example/contracts");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsList = Array.from(sutContractsInterfaces.keys());
    const expectedInvariantContractSources = sutContractsList.map(
      (contractId) => {
        const invariantContractName = `${contractId.split(".")[1]}.tests`;
        const invariantContractPath = `${contractsPath}/${invariantContractName}.clar`;
        return fs.readFileSync(invariantContractPath).toString();
      }
    );

    // Act
    const actualInvariantContractSources = sutContractsList.map((contractId) =>
      getTestContractSource(contractsPath, contractId)
    );

    // Assert
    expect(actualInvariantContractSources).toEqual(
      expectedInvariantContractSources
    );
  });
});

describe("Simnet contracts operations", () => {
  it("correctly initializes the local context for a given functions map", async () => {
    // Arrange
    const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
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

  // FIXME: Update this test to use the new `original contract` approach.
  // it("correctly initializes the Clarity context", async () => {
  //   // Arrange
  //   const manifestPath = resolve(__dirname, "./example/Clarinet.toml");
  //   const contractsPath = resolve(__dirname, "./example/contracts");
  //   const simnet = await initSimnet(manifestPath);
  //   const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
  //   const sutContractsList = Array.from(sutContractsInterfaces.keys());
  //   sutContractsList
  //     .map((contractId) =>
  //       buildRendezvousData(simnet, contractId, contractsPath)
  //     )
  //     .forEach((contractData) => {
  //       deployRendezvous(
  //         simnet,
  //         contractData.rendezvousFileName,
  //         contractData.rendezvousSource
  //       );
  //     });
  //   const rendezvousAllFunctions = getFunctionsFromContractInterfaces(
  //     new Map(Array.from(getSimnetDeployerContractsInterfaces(simnet)))
  //   );

  //   // The JS representation of Clarity `(some (tuple (called uint)))`, where `called` is
  //   // initialized to 0.
  //   const expectedClarityValue = Cl.some(Cl.tuple({ called: Cl.uint(0) }));
  //   const expectedContext = Array.from(rendezvousAllFunctions).flatMap(
  //     ([contractId, functions]) =>
  //       functions.map((f) => {
  //         return {
  //           contractId,
  //           functionName: f.name,
  //           called: expectedClarityValue,
  //         };
  //       })
  //   );

  //   // Act
  //   initializeClarityContext(simnet, rendezvousAllFunctions);

  //   const actualContext = Array.from(rendezvousAllFunctions).flatMap(
  //     ([contractId, functions]) =>
  //       functions.map((f) => {
  //         const actualValue = simnet.getMapEntry(
  //           contractId,
  //           "context",
  //           Cl.stringAscii(f.name)
  //         );
  //         return {
  //           contractId,
  //           functionName: f.name,
  //           called: actualValue,
  //         };
  //       })
  //   );

  //   // Assert
  //   expect(actualContext).toEqual(expectedContext);
  // });
});
