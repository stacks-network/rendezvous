import { initSimnet } from "@stacks/clarinet-sdk";
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
import { getManifestFileName } from "./app";
import { createIsolatedTestEnvironment } from "./test.utils";
import EventEmitter from "events";

const isolatedTestEnvPrefix = "rendezvous-test-invariant-";

describe("Simnet contracts operations", () => {
  it("correctly initializes the local context for a given contract and functions", async () => {
    // Setup
    const tempDir = createIsolatedTestEnvironment(
      resolve(__dirname, "example"),
      isolatedTestEnvPrefix
    );
    const manifestPath = join(tempDir, "Clarinet.toml");
    const simnet = await initSimnet(manifestPath);
    const sutContractsInterfaces = getSimnetDeployerContractsInterfaces(simnet);
    const sutContractsAllFunctions = getFunctionsFromContractInterfaces(
      sutContractsInterfaces
    );

    // Pick the first contract for testing.
    const [contractId, functions] = Array.from(
      sutContractsAllFunctions.entries()
    )[0];

    const expectedInitialContext = {
      [contractId]: Object.fromEntries(functions.map((f) => [f.name, 0])),
    };

    // Exercise
    const actualInitialContext = initializeLocalContext(contractId, functions);

    // Verify
    expect(actualInitialContext).toEqual(expectedInitialContext);

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("correctly initializes the Clarity context", async () => {
    // Setup
    const tempDir = createIsolatedTestEnvironment(
      resolve(__dirname, "example"),
      isolatedTestEnvPrefix
    );
    const simnet = await issueFirstClassCitizenship(
      tempDir,
      join(tempDir, getManifestFileName(tempDir, "counter")),
      "counter",
      new EventEmitter()
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

    // Pick the first contract for testing.
    const [contractId, functions] = Array.from(
      rendezvousAllFunctions.entries()
    )[0];

    // Exercise
    initializeClarityContext(simnet, contractId, functions);

    const actualContext = functions.map((f) => {
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
    });

    // Verify

    // The JS representation of Clarity `(some (tuple (called uint)))`, where
    // `called` is initialized to 0.
    const expectedClarityValue = Cl.some(Cl.tuple({ called: Cl.uint(0) }));
    const expectedContext = functions.map((f) => {
      return {
        contractId,
        functionName: f.name,
        called: expectedClarityValue,
      };
    });

    expect(actualContext).toEqual(expectedContext);

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });
});
