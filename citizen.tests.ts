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
import EventEmitter from "events";

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
    const radio = new EventEmitter();

    // Exercise
    const firstClassSimnet = await issueFirstClassCitizenship(
      tempDir,
      join(tempDir, getManifestFileName(tempDir, "cargo")),
      "cargo",
      radio
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
    const radio = new EventEmitter();

    // Exercise
    const firstClassSimnet = await issueFirstClassCitizenship(
      tempDir,
      join(tempDir, getManifestFileName(tempDir, "cargo")),
      "cargo",
      radio
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

describe("Test contract path resolution", () => {
  it("retrieves tests source code for a project contract", () => {
    // Setup
    const mockDeploymentPlan: DeploymentPlan = {
      genesis: { wallets: [], contracts: [] },
      plan: {
        batches: [
          {
            epoch: "2.1",
            transactions: [
              {
                "emulated-contract-publish": {
                  "contract-name": "project-contract",
                  "emulated-sender": "",
                  "clarity-version": 2,
                  path: "contracts/project-contract.clar",
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
    const cacheDir = "./.cache";
    const expectedTestContractContent =
      "(define-public (test-increment) (ok true))";
    const expectedProjectTestPath = join(
      ".",
      "contracts",
      "project-contract.tests.clar"
    );

    // Mock readFileSync to return test contract content for project contracts
    // if the path is the expected project test path, otherwise throw an error.
    const readFileSyncSpy = jest
      .spyOn(fs, "readFileSync")
      .mockImplementation((path) => {
        if (path === expectedProjectTestPath) {
          return expectedTestContractContent;
        }
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      });

    // Exercise
    const actual = getTestContractSource(
      cacheDir,
      mockDeploymentPlan,
      "project-contract",
      "."
    );

    // Verify
    expect(actual).toBe(expectedTestContractContent);
    expect(readFileSyncSpy).toHaveBeenCalledWith(expectedProjectTestPath, {
      encoding: "utf-8",
    });

    // Teardown
    jest.restoreAllMocks();
  });

  it("searches in contracts dir for requirement contract tests", () => {
    // Setup
    const senderAddress = "sender";
    const mockDeploymentPlan: DeploymentPlan = {
      genesis: { wallets: [], contracts: [] },
      plan: {
        batches: [
          {
            epoch: "2.1",
            transactions: [
              {
                "emulated-contract-publish": {
                  "contract-name": "requirement",
                  "emulated-sender": senderAddress,
                  "clarity-version": 2,
                  path: `./.cache/requirements/${senderAddress}.requirement.clar`,
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
    const cacheDir = "./.cache";
    const expectedTestContractContent =
      "(define-public (test-requirement) (ok true))";

    // The path where the tests corresponding to the requirement contract would
    // be searched (the contracts directory of the Clarinet project). Full
    // contract ID is used in the filename.
    const requirementTestPath = join(
      ".",
      "contracts",
      `${senderAddress}.requirement.tests.clar`
    );

    // Mock readFileSync to return
    const readFileSyncSpy = jest
      .spyOn(fs, "readFileSync")
      .mockImplementation((path) => {
        if (path === requirementTestPath) {
          return expectedTestContractContent;
        }
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      });

    // Act
    const actual = getTestContractSource(
      cacheDir,
      mockDeploymentPlan,
      "requirement",
      "."
    );

    // Assert
    expect(actual).toBe(expectedTestContractContent);
    // Verify it searched in the contracts directory (for requirement tests)
    expect(readFileSyncSpy).toHaveBeenCalledWith(
      requirementTestPath,
      expect.objectContaining({ encoding: "utf-8" })
    );

    // Teardown
    jest.restoreAllMocks();
  });

  it("throws error when test contract does not exist", () => {
    // Arrange
    const mockDeploymentPlan: DeploymentPlan = {
      genesis: { wallets: [], contracts: [] },
      plan: {
        batches: [
          {
            epoch: "2.1",
            transactions: [
              {
                "emulated-contract-publish": {
                  "contract-name": "nonexistent",
                  "emulated-sender":
                    "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
                  "clarity-version": 2,
                  path: "contracts/nonexistent.clar",
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

    // Act & Assert
    expect(() =>
      getTestContractSource(".cache", mockDeploymentPlan, "nonexistent", ".")
    ).toThrow(
      'Error retrieving the corresponding test contract for the "nonexistent" contract'
    );
  });
});

describe("Deployment plan contract source retrieval", () => {
  it("retrieves contract source code from deployment plan path", () => {
    // Setup
    const senderAddress = "sender";
    const mockDeploymentPlan: DeploymentPlan = {
      genesis: { wallets: [], contracts: [] },
      plan: {
        batches: [
          {
            epoch: "2.1",
            transactions: [
              {
                "emulated-contract-publish": {
                  "contract-name": "counter",
                  "emulated-sender": senderAddress,
                  "clarity-version": 2,
                  path: "contracts/counter.clar",
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
    const manifestDir = ".";
    const expectedContractSource = "(define-data-var counter uint u0)";
    const contractTestSource = "(define-public (test-increment) (ok true))";
    const contractPath = join(manifestDir, "contracts", "counter.clar");
    const testPath = join(manifestDir, "contracts", "counter.tests.clar");

    // Mock readFileSync to return contract and test source.
    const readFileSyncSpy = jest
      .spyOn(fs, "readFileSync")
      .mockImplementation((path) => {
        // If the path is the expected contract path, return the expected
        // contract source.
        if (path === contractPath) {
          return expectedContractSource;
        }
        // If the path is the expected test path, return the expected test
        // source.
        if (path === testPath) {
          return contractTestSource;
        }
        // If the path is not the expected contract or test path, throw an
        // error.
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      });

    // Exercise
    const actual = buildRendezvousData(
      ".cache",
      mockDeploymentPlan,
      "counter",
      manifestDir
    );

    // Verify
    expect(readFileSyncSpy).toHaveBeenCalledWith(contractPath, {
      encoding: "utf-8",
    });
    // The rendezvous source code should contain the expected test source code
    // along with the original contract and context.
    expect(actual.rendezvousSourceCode).toContain(expectedContractSource);

    // Teardown
    jest.restoreAllMocks();
  });
});

describe("Deployment plan contract selection edge cases", () => {
  it("throws error when contract is not found in deployment plan", () => {
    // Arrange
    const mockDeploymentPlan: DeploymentPlan = {
      genesis: { wallets: [], contracts: [] },
      plan: { batches: [] },
      id: 0,
      name: "",
      network: "",
    };

    // Mock readFileSync to avoid actual file operations.
    jest.spyOn(fs, "readFileSync").mockImplementation(() => "");

    // Exercise & Verify
    expect(() =>
      buildRendezvousData(".cache", mockDeploymentPlan, "nonexistent", ".")
    ).toThrow('"nonexistent" contract not found in Clarinet.toml');

    // Teardown
    jest.restoreAllMocks();
  });

  it("throws error when multiple requirement contracts exist with no deployer match", () => {
    // Arrange
    const deployerAddress = "deployer";
    const sender1Address = "sender1";
    const sender2Address = "sender2";
    const contractName = "shared-contract";
    const mockDeploymentPlan: DeploymentPlan = {
      genesis: {
        wallets: [
          {
            name: "deployer",
            address: deployerAddress,
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
                  "contract-name": contractName,
                  "emulated-sender": sender1Address,
                  "clarity-version": 2,
                  path: `.cache/requirements/${sender1Address}.shared-contract.clar`,
                },
              },
              {
                "emulated-contract-publish": {
                  "contract-name": contractName,
                  "emulated-sender": sender2Address,
                  "clarity-version": 2,
                  path: `.cache/requirements/${sender2Address}.shared-contract.clar`,
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

    // Act & Assert
    expect(() =>
      buildRendezvousData(".cache", mockDeploymentPlan, "shared-contract", ".")
    ).toThrow(
      `Multiple contracts named "${contractName}" found in the deployment plan, no one deployed by the deployer`
    );
  });

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
    jest.restoreAllMocks();
  });
});
