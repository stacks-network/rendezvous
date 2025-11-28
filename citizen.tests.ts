import fc from "fast-check";
import {
  buildRendezvousData,
  getTestContractSource,
  issueFirstClassCitizenship,
  scheduleRendezvous,
} from "./citizen";
import { initSimnet } from "@stacks/clarinet-sdk";
import { join, resolve } from "path";
import fs, { existsSync, readFileSync, rmSync } from "fs";
import { createIsolatedTestEnvironment } from "./test.utils";
import * as toml from "@iarna/toml";
import yaml from "yaml";
import { getManifestFileName } from "./app";
import { DeploymentPlan } from "./citizen.types";
import { cvToValue, hexToCV } from "@stacks/transactions";

const isolatedTestEnvPrefix = "rendezvous-test-citizen-";

describe("Simnet deployment plan operations", () => {
  const manifestDir = "example";
  const manifestFileName = "Clarinet.toml";
  const deploymentPlanFileName = "default.simnet-plan.yaml";
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

  it("retrieves the simnet deployment plan", async () => {
    // Setup
    const tempDir = createIsolatedTestEnvironment(
      resolve(__dirname, "example"),
      isolatedTestEnvPrefix
    );
    const deploymentPlanPath = join(
      tempDir,
      "deployments",
      deploymentPlanFileName
    );

    rmSync(deploymentPlanPath, { force: true });
    if (existsSync(deploymentPlanPath)) {
      throw new Error("Deployment plan file already exists");
    }

    const manifestPath = join(tempDir, manifestFileName);
    await initSimnet(manifestPath);

    // Exercise
    const deploymentPlanContent = readFileSync(deploymentPlanPath, {
      encoding: "utf-8",
    }).toString();

    // Verify
    expect(deploymentPlanContent).toBeDefined();

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("retrieves the test contract source from the simnet deployment plan", () => {
    // Setup
    const tempDir = createIsolatedTestEnvironment(
      resolve(__dirname, "example"),
      isolatedTestEnvPrefix
    );
    const deploymentPlanPath = join(
      tempDir,
      "deployments",
      deploymentPlanFileName
    );

    const parsedDeploymentPlan = yaml.parse(
      readFileSync(deploymentPlanPath, { encoding: "utf-8" }).toString()
    );

    const parsedManifest = toml.parse(
      readFileSync(join(tempDir, manifestFileName), { encoding: "utf-8" })
    ) as any;
    const cacheDir = parsedManifest.project?.["cache_dir"] ?? "./.cache";

    // Exercise
    const actual = getTestContractSource(
      cacheDir,
      parsedDeploymentPlan,
      "counter",
      tempDir
    );

    // Verify
    const expected = readFileSync(
      join("example", "contracts", "counter.tests.clar"),
      { encoding: "utf-8" }
    );

    expect(actual).toBe(expected);

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("builds the rendezvous data", async () => {
    // Setup
    const tempDir = createIsolatedTestEnvironment(
      resolve(__dirname, "example"),
      isolatedTestEnvPrefix
    );
    const deploymentPlanPath = join(
      tempDir,
      "deployments",
      deploymentPlanFileName
    );
    const manifestPath = join(tempDir, manifestFileName);

    const simnet = await initSimnet(manifestPath);

    const parsedDeploymentPlan = yaml.parse(
      readFileSync(deploymentPlanPath, { encoding: "utf-8" }).toString()
    );

    const parsedManifest = toml.parse(
      readFileSync(join(tempDir, manifestFileName), { encoding: "utf-8" })
    ) as any;
    const cacheDir = parsedManifest.project?.["cache_dir"] ?? "./.cache";

    // Exercise
    const rendezvousSources = new Map(
      ["counter"]
        .map((contractName) =>
          buildRendezvousData(
            cacheDir,
            parsedDeploymentPlan,
            contractName,
            manifestDir
          )
        )
        .map((rendezvousContractData) => [
          rendezvousContractData.rendezvousContractId,
          rendezvousContractData.rendezvousSourceCode,
        ])
    );

    // Verify
    const counterSrc = readFileSync(
      join("example", "contracts", "counter.clar"),
      { encoding: "utf-8" }
    );
    const counterTestsSrc = readFileSync(
      join("example", "contracts", "counter.tests.clar"),
      { encoding: "utf-8" }
    );
    const rendezvousSrc = scheduleRendezvous(counterSrc, counterTestsSrc);
    const expected = new Map([[`${simnet.deployer}.counter`, rendezvousSrc]]);

    expect(rendezvousSources).toEqual(expected);

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("issues first-class citizenship", async () => {
    // Setup
    const tempDir = createIsolatedTestEnvironment(
      resolve(__dirname, "example"),
      isolatedTestEnvPrefix
    );

    // Exercise
    const firstClassSimnet = await issueFirstClassCitizenship(
      tempDir,
      join(tempDir, getManifestFileName(tempDir, "cargo")),
      "cargo"
    );
    const actual = firstClassSimnet.getContractSource("cargo");

    // Verify
    const cargoSrc = readFileSync(join("example", "contracts", "cargo.clar"), {
      encoding: "utf-8",
    });
    const cargoTestsSrc = readFileSync(
      join("example", "contracts", "cargo.tests.clar"),
      { encoding: "utf-8" }
    );
    const expected = scheduleRendezvous(cargoSrc, cargoTestsSrc);
    expect(actual).toBe(expected);

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });

  it(`the first-class citizenship simnet has the correct STX balances for the registered accounts`, async () => {
    // Setup
    const tempDir = createIsolatedTestEnvironment(
      resolve(__dirname, "example"),
      isolatedTestEnvPrefix
    );

    // Exercise
    const firstClassSimnet = await issueFirstClassCitizenship(
      tempDir,
      join(tempDir, getManifestFileName(tempDir, "cargo")),
      "cargo"
    );

    // Verify
    const balancesMap = new Map(
      Array.from([...firstClassSimnet.getAccounts().values()], (address) => {
        const balanceHex = firstClassSimnet.runSnippet(
          `(stx-get-balance '${address})`
        );
        return [address, cvToValue(hexToCV(balanceHex))];
      })
    );

    expect(Array.from(balancesMap.values())).toEqual(
      Array(firstClassSimnet.getAccounts().size).fill(BigInt(100000000000000))
    );

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe("Project contract priority over requirements", () => {
  it("should prioritize project contract over requirement when names match", () => {
    // Setup
    jest.spyOn(fs, "readFileSync").mockImplementation(() => "");

    const deployerAddress = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    const mockDeploymentPlan: DeploymentPlan = {
      genesis: {
        wallets: [
          {
            name: "deployer",
            address: deployerAddress,
            balance: "",
          },
          {
            name: "wallet_1",
            address: "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC",
            balance: "",
          },
        ],
        contracts: [],
      },
      plan: {
        batches: [
          {
            epoch: "2.1",
            transactions: [
              {
                "emulated-contract-publish": {
                  "contract-name": "shared-name-contract",
                  // Requirement contract sender. Different from deployer.
                  "emulated-sender": "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG",
                  "clarity-version": 2,
                  path: ".cache/requirements/SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.shared-name-contract.clar",
                },
              },
            ],
            id: 0,
          },
          {
            epoch: "3.0",
            transactions: [
              {
                "emulated-contract-publish": {
                  "contract-name": "shared-name-contract",
                  "emulated-sender": deployerAddress,
                  "clarity-version": 3,
                  path: "contracts/shared-name-contract.clar",
                },
              },
            ],
            id: 0,
          },
        ],
      },
      id: 0,
      name: "",
      network: "",
    };

    const contractName = "shared-name-contract";

    // Exercise
    const result = buildRendezvousData(
      "",
      mockDeploymentPlan,
      contractName,
      "/project"
    );

    // Verify
    const expectedRendezvousId = `${deployerAddress}.${contractName}`;
    expect(result.rendezvousContractId).toBe(expectedRendezvousId);

    // Teardown
    jest.clearAllMocks();
  });
});
