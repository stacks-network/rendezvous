import fc from "fast-check";
import {
  buildRendezvousData,
  deployContracts,
  getContractSource,
  getSbtcBalancesFromSimnet,
  getTestContractSource,
  groupContractsByEpochFromDeploymentPlan,
  issueFirstClassCitizenship,
  scheduleRendezvous,
} from "./citizen";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { join } from "path";
import fs, { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import yaml from "yaml";
import { getManifestFileName, tryParseRemoteDataSettings } from "./app";
import { ContractsByEpoch, DeploymentPlan } from "./citizen.types";
import { cvToValue, hexToCV } from "@stacks/transactions";
import EventEmitter from "events";

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
    const tempDir = mkdtempSync(join(tmpdir(), "simnet-test-"));
    cpSync(manifestDir, tempDir, { recursive: true });
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

  it("groups the contracts by epoch", async () => {
    // Setup
    const tempDir = mkdtempSync(join(tmpdir(), "simnet-test-"));
    cpSync(manifestDir, tempDir, { recursive: true });
    const deploymentPlanPath = join(
      tempDir,
      "deployments",
      deploymentPlanFileName
    );
    const manifestPath = join(tempDir, manifestFileName);

    await initSimnet(manifestPath);
    const parsedDeploymentPlan = yaml.parse(
      readFileSync(deploymentPlanPath, { encoding: "utf-8" }).toString()
    );

    // Exercise
    const actual =
      groupContractsByEpochFromDeploymentPlan(parsedDeploymentPlan);

    // Verify
    const expected = {
      "2.4": [
        {
          dao: {
            clarity_version: 2,
            path: "./.cache/requirements/SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.dao.clar",
          },
        },
        {
          "sip-010-trait-ft-standard": {
            clarity_version: 2,
            path: "./.cache/requirements/SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.sip-010-trait-ft-standard.clar",
          },
        },
        {
          "ststx-token": {
            clarity_version: 2,
            path: "./.cache/requirements/SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token.clar",
          },
        },
      ],
      "2.5": [
        {
          "extension-trait": {
            clarity_version: 2,
            path: "./.cache/requirements/SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.extension-trait.clar",
          },
        },
        {
          "proposal-trait": {
            clarity_version: 2,
            path: "./.cache/requirements/SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.proposal-trait.clar",
          },
        },
        {
          "executor-dao": {
            clarity_version: 2,
            path: "./.cache/requirements/SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.executor-dao.clar",
          },
        },
        {
          "trait-sip-010": {
            clarity_version: 2,
            path: "./.cache/requirements/SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.trait-sip-010.clar",
          },
        },
        {
          "amm-registry-v2-01": {
            clarity_version: 2,
            path: "./.cache/requirements/SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-registry-v2-01.clar",
          },
        },
        {
          "trait-flash-loan-user": {
            clarity_version: 2,
            path: "./.cache/requirements/SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.trait-flash-loan-user.clar",
          },
        },
        {
          "trait-semi-fungible": {
            clarity_version: 2,
            path: "./.cache/requirements/SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.trait-semi-fungible.clar",
          },
        },
        {
          "amm-vault-v2-01": {
            clarity_version: 2,
            path: "./.cache/requirements/SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-vault-v2-01.clar",
          },
        },
        {
          "token-amm-pool-v2-01": {
            clarity_version: 2,
            path: "./.cache/requirements/SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-amm-pool-v2-01.clar",
          },
        },
        {
          "amm-pool-v2-01": {
            clarity_version: 2,
            path: "./.cache/requirements/SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.amm-pool-v2-01.clar",
          },
        },
        {
          "token-wstx-v2": {
            clarity_version: 2,
            path: "./.cache/requirements/SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-wstx-v2.clar",
          },
        },
        {
          "rendezvous-token": {
            clarity_version: 2,
            path: "contracts/rendezvous-token.clar",
          },
        },
      ],
      "3.0": [
        {
          "liquidity-locker": {
            clarity_version: 3,
            path: "./.cache/requirements/SP1E0XBN9T4B10E9QMR7XMFJPMA19D77WY3KP2QKC.liquidity-locker.clar",
          },
        },
        {
          cargo: {
            path: "contracts/cargo.clar",
            clarity_version: 3,
          },
        },
        {
          counter: {
            path: "contracts/counter.clar",
            clarity_version: 3,
          },
        },
        {
          reverse: {
            path: "contracts/reverse.clar",
            clarity_version: 3,
          },
        },
        {
          "send-tokens": {
            path: "contracts/send-tokens.clar",
            clarity_version: 3,
          },
        },
        {
          slice: {
            path: "contracts/slice.clar",
            clarity_version: 3,
          },
        },
      ],
      "3.1": [
        {
          "clarity-stacks": {
            clarity_version: 3,
            path: "./.cache/requirements/SP1E0XBN9T4B10E9QMR7XMFJPMA19D77WY3KP2QKC.clarity-stacks.clar",
          },
        },
        {
          "clarity-stacks-helper": {
            clarity_version: 3,
            path: "./.cache/requirements/SP1E0XBN9T4B10E9QMR7XMFJPMA19D77WY3KP2QKC.clarity-stacks-helper.clar",
          },
        },
        {
          "self-listing-helper-v3a": {
            clarity_version: 3,
            path: "contracts/self-listing-helper-v3a.clar",
          },
        },
      ],
    };

    expect(actual).toEqual(expected);

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("retrieves the test contract source from the simnet deployment plan", () => {
    // Setup
    const tempDir = mkdtempSync(join(tmpdir(), "simnet-test-"));
    cpSync(manifestDir, tempDir, { recursive: true });
    const deploymentPlanPath = join(
      tempDir,
      "deployments",
      deploymentPlanFileName
    );

    const parsedDeploymentPlan = yaml.parse(
      readFileSync(deploymentPlanPath, { encoding: "utf-8" }).toString()
    );

    // Exercise
    const actual = getTestContractSource(
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
    const tempDir = mkdtempSync(join(tmpdir(), "simnet-test-"));
    cpSync(manifestDir, tempDir, { recursive: true });
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

    // Exercise
    const rendezvousSources = new Map(
      ["counter"]
        .map((contractName) =>
          buildRendezvousData(parsedDeploymentPlan, contractName, manifestDir)
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

  it("retrieves the contract source for a target contract", async () => {
    // Setup
    const tempDir = mkdtempSync(join(tmpdir(), "simnet-test-"));
    cpSync(manifestDir, tempDir, { recursive: true });
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

    const rendezvousSources = new Map(
      ["counter"]
        .map((contractName) =>
          buildRendezvousData(parsedDeploymentPlan, contractName, manifestDir)
        )
        .map((rendezvousContractData) => [
          rendezvousContractData.rendezvousContractId,
          rendezvousContractData.rendezvousSourceCode,
        ])
    );

    const contractsByEpoch =
      groupContractsByEpochFromDeploymentPlan(parsedDeploymentPlan);

    const counterContractData = contractsByEpoch["3.0"].find(
      (contract) => contract.counter
    )!.counter;

    // Exercise
    const actual = getContractSource(
      ["counter"],
      rendezvousSources,
      "counter",
      simnet.deployer,
      {
        path: counterContractData.path,
        clarity_version: counterContractData.clarity_version,
      },
      tempDir
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
    const expected = scheduleRendezvous(counterSrc, counterTestsSrc);

    expect(actual).toBe(expected);

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("retrieves the contract source for a non-target contract", async () => {
    // Setup
    const tempDir = mkdtempSync(join(tmpdir(), "simnet-test-"));
    cpSync(manifestDir, tempDir, { recursive: true });
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

    const rendezvousSources = new Map(
      ["counter"]
        .map((contractName) =>
          buildRendezvousData(parsedDeploymentPlan, contractName, manifestDir)
        )
        .map((rendezvousContractData) => [
          rendezvousContractData.rendezvousContractId,
          rendezvousContractData.rendezvousSourceCode,
        ])
    );

    const contractsByEpoch =
      groupContractsByEpochFromDeploymentPlan(parsedDeploymentPlan);

    const cargoContractData = contractsByEpoch["3.0"].find(
      (contract) => contract.cargo
    )!.cargo;

    // Exercise
    const actual = getContractSource(
      ["counter"],
      rendezvousSources,
      "cargo",
      simnet.deployer,
      {
        path: cargoContractData.path,
        clarity_version: cargoContractData.clarity_version,
      },
      tempDir
    );

    // Verify
    const expected = readFileSync(join("example", "contracts", "cargo.clar"), {
      encoding: "utf-8",
    });

    expect(actual).toBe(expected);

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("issues first-class citizenship", async () => {
    // Setup
    const tempDir = mkdtempSync(join(tmpdir(), "simnet-test-"));
    cpSync(manifestDir, tempDir, { recursive: true });

    // Exercise
    const firstClassSimnet = await issueFirstClassCitizenship(
      tempDir,
      join(tempDir, getManifestFileName(tempDir, "cargo")),
      tryParseRemoteDataSettings(
        join(manifestDir, "Clarinet.toml"),
        new EventEmitter()
      ),
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
    const tempDir = mkdtempSync(join(tmpdir(), "simnet-test-"));
    cpSync(manifestDir, tempDir, { recursive: true });

    // Exercise
    const firstClassSimnet = await issueFirstClassCitizenship(
      tempDir,
      join(tempDir, getManifestFileName(tempDir, "cargo")),
      tryParseRemoteDataSettings(
        join(manifestDir, "Clarinet.toml"),
        new EventEmitter()
      ),
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

  it(`the first-class citizenship simnet has the correct sBTC balances for the registered accounts`, async () => {
    // Setup
    const tempDir = mkdtempSync(join(tmpdir(), "simnet-test-"));
    cpSync(manifestDir, tempDir, { recursive: true });

    // Exercise
    const firstClassSimnet = await issueFirstClassCitizenship(
      tempDir,
      join(tempDir, getManifestFileName(tempDir, "counter")),
      tryParseRemoteDataSettings(
        join(manifestDir, "Clarinet.toml"),
        new EventEmitter()
      ),
      "counter"
    );

    // Verify
    const sbtcBalancesMap = getSbtcBalancesFromSimnet(firstClassSimnet);

    // The expected balance is 0 (number) for all accounts, since the example
    // Clarinet project does not operate with sBTC.
    const numAccounts = firstClassSimnet.getAccounts().size;
    const numZeroBalanceAccounts = Array.from(sbtcBalancesMap.values()).filter(
      (balance) => balance === 0
    ).length;
    expect(numZeroBalanceAccounts).toBe(numAccounts);

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });
});

describe("Requirement detection", () => {
  it("should identify requirement contracts in default cache directory", async () => {
    // Setup
    const mockSimnet = {
      setEpoch: jest.fn(),
      deployContract: jest.fn(),
      deployer: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    };

    const mockGetContractSource = jest
      .fn()
      .mockReturnValue("(define-read-only (test) (ok true))");

    const manifestDir = "/project";
    const cacheDir = ".cache";
    const contractsByEpoch: ContractsByEpoch = {
      "2.0": [
        {
          "requirement-contract": {
            path: "./.cache/requirements/SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.requirement-contract.clar",
            clarity_version: 2,
          },
        },
      ],
      "2.05": [],
      "2.1": [],
      "2.2": [],
      "2.3": [],
      "2.4": [],
      "2.5": [],
      "3.0": [],
    };

    // Exercise
    await deployContracts(
      mockSimnet as any,
      contractsByEpoch,
      manifestDir,
      cacheDir,
      mockGetContractSource
    );

    // Verify
    expect(mockSimnet.deployContract).toHaveBeenCalledWith(
      "requirement-contract",
      "(define-read-only (test) (ok true))",
      { clarityVersion: 2 },
      // Different than the deployer address, as it is a requirement contract.
      "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG"
    );

    // Teardown
    jest.clearAllMocks();
  });

  it("should identify regular contracts not in requirements", async () => {
    // Setup
    const mockSimnet = {
      setEpoch: jest.fn(),
      deployContract: jest.fn(),
      deployer: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    };

    const mockGetContractSource = jest
      .fn()
      .mockReturnValue("(define-read-only (test) (ok true))");

    const manifestDir = "/project";
    const cacheDir = ".cache";
    const contractsByEpoch: ContractsByEpoch = {
      "2.0": [],
      "2.05": [],
      "2.1": [],
      "2.2": [],
      "2.3": [],
      "2.4": [],
      "2.5": [],
      "3.0": [
        {
          "project-contract": {
            path: "contracts/regular-contract.clar",
            clarity_version: 3,
          },
        },
      ],
    };

    // Exercise
    await deployContracts(
      mockSimnet as any,
      contractsByEpoch,
      manifestDir,
      cacheDir,
      mockGetContractSource
    );

    // Verify
    expect(mockSimnet.deployContract).toHaveBeenCalledWith(
      "project-contract",
      "(define-read-only (test) (ok true))",
      { clarityVersion: 3 },
      mockSimnet.deployer
    );

    // Teardown
    jest.clearAllMocks();
  });

  it("should handle custom cache directory", async () => {
    // Setup
    const mockSimnet = {
      setEpoch: jest.fn(),
      deployContract: jest.fn(),
      deployer: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    };

    const mockGetContractSource = jest
      .fn()
      .mockReturnValue("(define-read-only (test) (ok true))");

    const manifestDir = "/project";
    const cacheDir = "custom-cache";
    const contractsByEpoch: ContractsByEpoch = {
      "2.0": [],
      "2.05": [],
      "2.1": [
        {
          "custom-requirement": {
            path: "custom-cache/requirements/SP1234567890ABCDEF.custom-requirement.clar",
            clarity_version: 2,
          },
        },
      ],
      "2.2": [],
      "2.3": [],
      "2.4": [],
      "2.5": [],
      "3.0": [],
    };

    // Exercise
    await deployContracts(
      mockSimnet as any,
      contractsByEpoch,
      manifestDir,
      cacheDir,
      mockGetContractSource
    );

    // Verify
    expect(mockSimnet.deployContract).toHaveBeenCalledWith(
      "custom-requirement",
      "(define-read-only (test) (ok true))",
      { clarityVersion: 2 },
      "SP1234567890ABCDEF"
    );

    // Teardown
    jest.clearAllMocks();
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
