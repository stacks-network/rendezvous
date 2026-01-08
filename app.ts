#!/usr/bin/env node
import { join, resolve } from "path";
import { EventEmitter } from "events";
import { checkProperties } from "./property";
import { checkInvariants } from "./invariant";
import {
  getContractNameFromContractId,
  getFunctionsFromContractInterfaces,
  getSimnetDeployerContractsInterfaces,
} from "./shared";
import { issueFirstClassCitizenship } from "./citizen";
import { version } from "./package.json";
import { red } from "ansicolor";
import { existsSync } from "fs";
import { parseArgs } from "util";
import { getFailureFilePath } from "./persistence";

/**
 * Test execution modes for Rendezvous.
 */
export enum TestMode {
  /** Skip regressions, only run new tests */
  NEW = "new",
  /** Only replay regressions, no new tests */
  REGRESSION = "reg",
}

const logger = (log: string, logLevel: "log" | "error" | "info" = "log") => {
  console[logLevel](log);
};

/**
 * Gets the manifest file name for a Clarinet project.
 * If a custom manifest exists (`Clarinet-<contract-name>.toml`), it is used.
 * Otherwise, the default `Clarinet.toml` is returned.
 * @param manifestDir The relative path to the Clarinet project directory.
 * @param targetContractName The target contract name.
 * @returns The manifest file name.
 */
export const getManifestFileName = (
  manifestDir: string,
  targetContractName: string
) => {
  const isCustomManifest = existsSync(
    resolve(manifestDir, `Clarinet-${targetContractName}.toml`)
  );

  if (isCustomManifest) {
    return `Clarinet-${targetContractName}.toml`;
  }

  return "Clarinet.toml";
};

const helpMessage = `
  rv v${version}
  
  Usage: rv <path> <contract> <type> [OPTIONS]

  Arguments:
    <path>        Path to the Clarinet project
    <contract>    Contract name to fuzz
    <type>        Test type: test | invariant

  Options:
    --seed=<n>    Seed for replay functionality
    --runs=<n>    Number of test iterations [default: 100]
    --mode=<m>    Test mode: new | reg [default: new]
                    new - Run a fresh round of tests
                    reg - Run regression tests
    --dial=<f>    Path to custom dialers file
    --bail        Stop on first failure
    -h, --help    Show this message

  Learn more: https://stacks-network.github.io/rendezvous/
  `;

export async function main() {
  const radio = new EventEmitter();
  radio.on("logMessage", (log) => logger(log));
  radio.on("logFailure", (log) => logger(red(log), "error"));

  const { positionals: positionalArgs, values: options } = parseArgs({
    allowPositionals: true,
    args: process.argv.slice(2),
    options: {
      seed: { type: "string" },
      runs: { type: "string" },
      dial: { type: "string" },
      bail: { type: "boolean" },
      mode: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  const [manifestDir, sutContractName, type] = positionalArgs;
  const runConfig = {
    /** The relative path to the Clarinet project. */
    manifestDir: manifestDir,
    /** The target contract name. */
    sutContractName: sutContractName,
    /** The type of testing to be executed. Valid values: test, invariant. */
    type: type?.toLowerCase(),
    /** The seed to use for the replay functionality. */
    seed: options.seed ? parseInt(options.seed, 10) : undefined,
    /** The number of runs to use. */
    runs: options.runs ? parseInt(options.runs, 10) : undefined,
    /** Whether to bail on the first failure. */
    bail: options.bail || false,
    /** The test mode. Valid values: new, reg. Default: new. */
    mode: (options.mode?.toLowerCase() as TestMode | undefined) || TestMode.NEW,
    /** The path to the dialer file. */
    dial: options.dial || undefined,
    /** Whether to show the help message. */
    help: options.help || false,
  };

  if (runConfig.help) {
    radio.emit("logMessage", helpMessage);
    return;
  }

  if (!runConfig.manifestDir) {
    radio.emit(
      "logMessage",
      red(
        "\nNo path to Clarinet project provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities."
      )
    );
    radio.emit("logMessage", helpMessage);
    return;
  }

  if (!runConfig.sutContractName) {
    radio.emit(
      "logMessage",
      red(
        "\nNo target contract name provided. Please provide the contract name to be fuzzed."
      )
    );
    radio.emit("logMessage", helpMessage);
    return;
  }

  if (!runConfig.type || !["test", "invariant"].includes(runConfig.type)) {
    radio.emit(
      "logMessage",
      red(
        "\nInvalid type provided. Please provide the type of test to be executed. Possible values: test, invariant."
      )
    );
    radio.emit("logMessage", helpMessage);
    return;
  }

  if (!Object.values(TestMode).includes(runConfig.mode as TestMode)) {
    radio.emit(
      "logMessage",
      red("\nInvalid mode provided. Possible values: all (default), new, reg.")
    );
    radio.emit("logMessage", helpMessage);
    return;
  }

  // 79 characters long separator before the run configuration.
  radio.emit(
    "logMessage",
    "-------------------------------------------------------------------------------"
  );
  /**
   * The relative path to the manifest file, either `Clarinet.toml` or
   * `Clarinet-<contract-name>.toml`. If the latter exists, it is used.
   */
  const manifestPath = join(
    runConfig.manifestDir,
    getManifestFileName(runConfig.manifestDir, runConfig.sutContractName)
  );
  radio.emit("logMessage", `Using manifest path: ${manifestPath}`);
  radio.emit("logMessage", `Target contract: ${runConfig.sutContractName}`);

  if (runConfig.seed !== undefined) {
    radio.emit("logMessage", `Using seed: ${runConfig.seed}`);
  }

  if (runConfig.runs !== undefined) {
    radio.emit("logMessage", `Using runs: ${runConfig.runs}`);
  }

  if (runConfig.bail) {
    radio.emit("logMessage", `Bailing on first failure.`);
  }

  if (runConfig.mode) {
    const modeDesc =
      runConfig.mode === TestMode.NEW
        ? "NEW (run a fresh round of tests)"
        : "REG (run regression tests)";
    radio.emit("logMessage", `Mode: ${modeDesc}`);
    if (runConfig.mode === TestMode.REGRESSION) {
      radio.emit(
        "logMessage",
        `Regressions loaded from: ${resolve(
          getFailureFilePath(runConfig.sutContractName)
        )}`
      );
    }
  }

  if (runConfig.dial !== undefined) {
    radio.emit("logMessage", `Using dial path: ${runConfig.dial}`);
  }

  // 79 characters long separator between the run configuration and the
  // execution.
  radio.emit(
    "logMessage",
    "-------------------------------------------------------------------------------\n"
  );

  const simnet = await issueFirstClassCitizenship(
    runConfig.manifestDir,
    manifestPath,
    runConfig.sutContractName,
    radio
  );

  /**
   * The list of contract IDs for the SUT contract names, as per the simnet.
   */
  const rendezvousList = Array.from(
    getSimnetDeployerContractsInterfaces(simnet).keys()
  ).filter(
    (deployedContract) =>
      getContractNameFromContractId(deployedContract) ===
      runConfig.sutContractName
  );

  const rendezvousAllFunctions = getFunctionsFromContractInterfaces(
    new Map(
      Array.from(getSimnetDeployerContractsInterfaces(simnet)).filter(
        ([contractId]) => rendezvousList.includes(contractId)
      )
    )
  );

  // Select the testing routine based on `type`.
  // If "invariant", call `checkInvariants` to verify contract invariants.
  // If "test", call `checkProperties` for property-based testing.
  switch (runConfig.type) {
    case "invariant": {
      await checkInvariants(
        simnet,
        runConfig.sutContractName,
        rendezvousList,
        rendezvousAllFunctions,
        runConfig.seed,
        runConfig.runs,
        runConfig.dial,
        runConfig.bail,
        runConfig.mode,
        radio
      );
      break;
    }

    case "test": {
      checkProperties(
        simnet,
        runConfig.sutContractName,
        rendezvousList,
        rendezvousAllFunctions,
        runConfig.seed,
        runConfig.runs,
        runConfig.bail,
        runConfig.mode,
        radio
      );
      break;
    }
  }
}

if (require.main === module) {
  main();
}
