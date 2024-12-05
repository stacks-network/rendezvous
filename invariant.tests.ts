import { initSimnet } from "@hirosystems/clarinet-sdk";
import {
  getContractNameFromRendezvousId,
  initializeClarityContext,
  initializeLocalContext,
} from "./invariant";
import {
  getFunctionsFromContractInterfaces,
  getSimnetDeployerContractsInterfaces,
} from "./shared";
import { join } from "path";
import { issueFirstClassCitizenship } from "./citizen";
import { Cl } from "@stacks/transactions";
import fc from "fast-check";

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
    const simnet = await issueFirstClassCitizenship("example", "counter");

    const rendezvousList = Array.from(
      getSimnetDeployerContractsInterfaces(simnet).keys()
    ).filter((deployedContract) =>
      ["counter"].includes(deployedContract.split(".")[1])
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

describe("Rendezvous contract name", () => {
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
