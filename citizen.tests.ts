import fc from "fast-check";
import {
  buildRendezvousData,
  getContractSource,
  getTestContractSource,
  groupContractsByEpochFromSimnetPlan,
  issueFirstClassCitizenship,
  scheduleRendezvous,
} from "./citizen";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { join } from "path";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import yaml from "yaml";

describe("Simnet deployment plan operations", () => {
  const manifestDir = "example";
  const manifestFileName = "Clarinet.toml";
  const simnetPlanFileName = "default.simnet-plan.yaml";
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
    const simnetPlanPath = join(tempDir, "deployments", simnetPlanFileName);

    rmSync(simnetPlanPath, { force: true });
    if (existsSync(simnetPlanPath)) {
      throw new Error("Simnet plan file already exists");
    }

    const manifestPath = join(tempDir, manifestFileName);
    await initSimnet(manifestPath);

    // Exercise
    const simnetPlanContent = readFileSync(simnetPlanPath, {
      encoding: "utf-8",
    }).toString();

    // Verify
    expect(simnetPlanContent).toBeDefined();

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("groups the contracts by epoch", async () => {
    // Setup
    const tempDir = mkdtempSync(join(tmpdir(), "simnet-test-"));
    cpSync(manifestDir, tempDir, { recursive: true });
    const simnetPlanPath = join(tempDir, "deployments", simnetPlanFileName);
    const manifestPath = join(tempDir, manifestFileName);

    await initSimnet(manifestPath);
    const parsedSimnetPlan = yaml.parse(
      readFileSync(simnetPlanPath, { encoding: "utf-8" }).toString()
    );

    // Exercise
    const actual = groupContractsByEpochFromSimnetPlan(parsedSimnetPlan);

    // Verify
    const expected = {
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
    const simnetPlanPath = join(tempDir, "deployments", simnetPlanFileName);

    const parsedSimnetPlan = yaml.parse(
      readFileSync(simnetPlanPath, { encoding: "utf-8" }).toString()
    );

    // Exercise
    const actual = getTestContractSource(parsedSimnetPlan, "counter", tempDir);

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
    const simnetPlanPath = join(tempDir, "deployments", simnetPlanFileName);
    const manifestPath = join(tempDir, manifestFileName);

    await initSimnet(manifestPath);

    const parsedSimnetPlan = yaml.parse(
      readFileSync(simnetPlanPath, { encoding: "utf-8" }).toString()
    );

    // Exercise
    const rendezvousSources = new Map(
      ["counter"]
        .map((contractName) =>
          buildRendezvousData(parsedSimnetPlan, contractName, manifestDir)
        )
        .map((rendezvousContractData) => [
          rendezvousContractData.rendezvousContractName,
          rendezvousContractData.rendezvousSource,
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
    const expected = new Map([["counter", rendezvousSrc]]);

    expect(rendezvousSources).toEqual(expected);

    // Teardown
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("retrieves the contract source for a target contract", async () => {
    // Setup
    const tempDir = mkdtempSync(join(tmpdir(), "simnet-test-"));
    cpSync(manifestDir, tempDir, { recursive: true });
    const simnetPlanPath = join(tempDir, "deployments", simnetPlanFileName);
    const manifestPath = join(tempDir, manifestFileName);

    await initSimnet(manifestPath);

    const parsedSimnetPlan = yaml.parse(
      readFileSync(simnetPlanPath, { encoding: "utf-8" }).toString()
    );

    const rendezvousSources = new Map(
      ["counter"]
        .map((contractName) =>
          buildRendezvousData(parsedSimnetPlan, contractName, manifestDir)
        )
        .map((rendezvousContractData) => [
          rendezvousContractData.rendezvousContractName,
          rendezvousContractData.rendezvousSource,
        ])
    );

    const contractsByEpoch =
      groupContractsByEpochFromSimnetPlan(parsedSimnetPlan);

    const counterContractData = contractsByEpoch["3.0"].find(
      (contract) => contract.counter
    )!.counter;

    // Exercise
    const actual = getContractSource(
      ["counter"],
      rendezvousSources,
      "counter",
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
    const simnetPlanPath = join(tempDir, "deployments", simnetPlanFileName);
    const manifestPath = join(tempDir, manifestFileName);

    await initSimnet(manifestPath);

    const parsedSimnetPlan = yaml.parse(
      readFileSync(simnetPlanPath, { encoding: "utf-8" }).toString()
    );

    const rendezvousSources = new Map(
      ["counter"]
        .map((contractName) =>
          buildRendezvousData(parsedSimnetPlan, contractName, manifestDir)
        )
        .map((rendezvousContractData) => [
          rendezvousContractData.rendezvousContractName,
          rendezvousContractData.rendezvousSource,
        ])
    );

    const contractsByEpoch =
      groupContractsByEpochFromSimnetPlan(parsedSimnetPlan);

    const cargoContractData = contractsByEpoch["3.0"].find(
      (contract) => contract.cargo
    )!.cargo;

    // Exercise
    const actual = getContractSource(
      ["counter"],
      rendezvousSources,
      "cargo",
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
    const firstClassSimnet = await issueFirstClassCitizenship(tempDir, "cargo");
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
});
