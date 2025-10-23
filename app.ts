#!/usr/bin/env node
import { join, resolve } from "path";
import { EventEmitter } from "events";
import toml from "toml";
import minimist from "minimist";
import { checkProperties } from "./property";
import { checkInvariants } from "./invariant";
import {
  getContractNameFromContractId,
  getFunctionsFromContractInterfaces,
  getSimnetDeployerContractsInterfaces,
} from "./shared";
import { issueFirstClassCitizenship } from "./citizen";
import { version } from "./package.json";
import { red, yellow } from "ansicolor";
import { existsSync, readFileSync } from "fs";
import { DialerRegistry } from "./dialer";
import { RemoteDataSettings } from "./app.types";

const logger = (log: string, logLevel: "log" | "error" | "info" = "log") => {
  console[logLevel](log);
};

/**
 * The object used to initialize an empty simnet session with, when no remote
 * data is enabled in the `Clarinet.toml` file.
 */
export const noRemoteData = {
  enabled: false,
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

export const tryParseRemoteDataSettings = (
  manifestPath: string,
  radio: EventEmitter
): RemoteDataSettings => {
  const clarinetToml = toml.parse(readFileSync(resolve(manifestPath), "utf-8"));
  const remoteDataUserSettings = clarinetToml.repl?.remote_data ?? undefined;

  if (remoteDataUserSettings && remoteDataUserSettings?.enabled === true) {
    radio.emit(
      "logMessage",
      yellow(
        "\nUsing remote data. Setting up the environment can take up to a minute..."
      )
    );
  }

  // If no remote data settings are provided, we still need to return an object
  // with the `enabled` property set to `false`. That is what simnet expects
  // at least in order to initialize an empty simnet session.
  if (!remoteDataUserSettings) {
    return noRemoteData;
  }

  return remoteDataUserSettings;
};

const helpMessage = `
  rv v${version}
  
  Usage: rv <path-to-clarinet-project> <contract-name> <type> [--seed=<seed>] [--path=<path>] [--runs=<runs>] [--dial=<path-to-dialers-file>] [--help]

  Positional arguments:
    path-to-clarinet-project - The path to the Clarinet project.
    contract-name - The name of the contract to be fuzzed.
    type - The type to use for exercising the contracts. Possible values: test, invariant.

  Options:
    --seed - The seed to use for the replay functionality.
    --path - The path to use for the replay functionality.
    --runs - The runs to use for iterating over the tests. Default: 100.
    --bail - Stop after the first failure.
    --dial – The path to a JavaScript file containing custom pre- and post-execution functions (dialers).
    --help - Show the help message.
  `;

export async function main() {
  const radio = new EventEmitter();
  radio.on("logMessage", (log) => logger(log));
  radio.on("logFailure", (log) => logger(red(log), "error"));

  const argv = minimist(process.argv.slice(2), {
    string: ["seed", "path", "runs", "dial"],
    boolean: ["help", "bail"],
    alias: {
      h: "help",
    },
  });

  const runConfig = {
    /** The relative path to the Clarinet project. */
    manifestDir: argv._[0],
    /** The target contract name. */
    sutContractName: argv._[1],
    /** The type of testing to be executed. Valid values: test, invariant. */
    type: argv._[2]?.toLowerCase(),
    /** The seed to use for the replay functionality. */
    seed: argv.seed ? parseInt(argv.seed, 10) : undefined,
    /** The path to use for the replay functionality. */
    path: argv.path || undefined,
    /** The number of runs to use. */
    runs: argv.runs ? parseInt(argv.runs, 10) : undefined,
    /** Whether to bail on the first failure. */
    bail: argv.bail || false,
    /** The path to the dialer file. */
    dial: argv.dial || undefined,
    /** Whether to show the help message. */
    help: argv.help || false,
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

  if (runConfig.path !== undefined) {
    radio.emit("logMessage", `Using path: ${runConfig.path}`);
  }

  if (runConfig.runs !== undefined) {
    radio.emit("logMessage", `Using runs: ${runConfig.runs}`);
  }

  if (runConfig.bail) {
    radio.emit("logMessage", `Bailing on first failure.`);
  }

  if (runConfig.dial !== undefined) {
    radio.emit("logMessage", `Using dial path: ${runConfig.dial}`);
  }

  /**
   * The dialer registry, which is used to keep track of all the custom dialers
   * registered by the user using the `--dial` flag.
   */
  const dialerRegistry =
    runConfig.dial !== undefined
      ? new DialerRegistry(runConfig.dial)
      : undefined;

  if (dialerRegistry !== undefined) {
    dialerRegistry.registerDialers();
  }

  const remoteDataSettings = tryParseRemoteDataSettings(manifestPath, radio);

  const simnet = await issueFirstClassCitizenship(
    runConfig.manifestDir,
    manifestPath,
    remoteDataSettings,
    runConfig.sutContractName
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
        runConfig.path,
        runConfig.runs,
        runConfig.bail,
        dialerRegistry,
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
        runConfig.path,
        runConfig.runs,
        runConfig.bail,
        radio
      );
      break;
    }
  }
}

if (require.main === module) {
  main();
}
