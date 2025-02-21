import { initSimnet } from "@hirosystems/clarinet-sdk";
import { initializeClarityContext, initializeLocalContext } from "./invariant";
import {
  getContractNameFromContractId,
  getFunctionsFromContractInterfaces,
  getSimnetDeployerContractsInterfaces,
} from "./shared";
import { join } from "path";
import { issueFirstClassCitizenship } from "./citizen";
import { Cl } from "@stacks/transactions";
import { getManifestFileName, parseRemoteDataSettings } from "./app";
import { EventEmitter } from "events";

describe("Simnet contracts operations", () => {
  it("correctly initializes the local context for a given functions map", async () => {
    // Arrange
    const manifestPath = join("example", "Clarinet.toml");
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
    const simnet = await issueFirstClassCitizenship(
      "example",
      join("example", getManifestFileName("example", "counter")),
      "counter",
      parseRemoteDataSettings(
        join("example", "Clarinet.toml"),
        new EventEmitter()
      )
    );

    const rendezvousList = Array.from(
      getSimnetDeployerContractsInterfaces(simnet).keys()
    ).filter((deployedContract) =>
      ["counter"].includes(getContractNameFromContractId(deployedContract))
    );

    const rendezvousAllFunctions = getFunctionsFromContractInterfaces(
      new Map(
        Array.from(getSimnetDeployerContractsInterfaces(simnet)).filter(
          ([contractId]) => rendezvousList.includes(contractId)
        )
      )
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

    // The JS representation of Clarity `(some (tuple (called uint)))`, where
    // `called` is initialized to 0.
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

    expect(actualContext).toEqual(expectedContext);
  });
});
