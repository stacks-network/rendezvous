import fc from "fast-check";
import {
  buildRendezvousData,
  getContractSource,
  getSbtcBalancesFromSimnet,
  getTestContractSource,
  groupContractsByEpochFromDeploymentPlan,
  issueFirstClassCitizenship,
  scheduleRendezvous,
} from "./citizen";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { join } from "path";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import yaml from "yaml";
import { getManifestFileName, tryParseRemoteDataSettings } from "./app";
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
          "rendezvous-token": {
            clarity_version: 2,
            path: "contracts/rendezvous-token.clar",
          },
        },
      ],
      "3.0": [
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
