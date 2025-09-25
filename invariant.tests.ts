import { initSimnet } from "@hirosystems/clarinet-sdk";
import { initializeClarityContext, initializeLocalContext } from "./invariant";
import {
  getContractNameFromContractId,
  getFunctionsFromContractInterfaces,
  getSimnetDeployerContractsInterfaces,
} from "./shared";
import { join, resolve } from "path";
import { rmSync } from "fs";
import { issueFirstClassCitizenship } from "./citizen";
import { Cl } from "@stacks/transactions";
import { getManifestFileName, tryParseRemoteDataSettings } from "./app";
import { EventEmitter } from "events";
import { createIsolatedTestEnvironment } from "./test.utils";

describe("Simnet contracts operations", () => {
  it("correctly initializes the local context for a given functions map", async () => {
    // Setup
    const tempDir = createIsolatedTestEnvironment(
      resolve(__dirname, "example"),
      "invariant-test-"
    );
    const manifestPath = join(tempDir, "Clarinet.toml");
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

    // Exercise
    const actualInitialContext = initializeLocalContext(
      sutContractsAllFunctions
    );

    // Verify
    expect(actualInitialContext).toEqual(expectedInitialContext);

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("correctly initializes the Clarity context", async () => {
    // Setup
    const tempDir = createIsolatedTestEnvironment(
      resolve(__dirname, "example"),
      "invariant-test-"
    );
    const simnet = await issueFirstClassCitizenship(
      tempDir,
      join(tempDir, getManifestFileName(tempDir, "counter")),
      tryParseRemoteDataSettings(
        join(tempDir, "Clarinet.toml"),
        new EventEmitter()
      ),
      "counter"
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

    // Exercise
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

    // Verify

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

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });
});
