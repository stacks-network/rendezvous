#!/usr/bin/env node
import { join, resolve } from "path";
import { EventEmitter } from "events";
import toml from "toml";
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

const logger = (log: string, logLevel: "log" | "error" | "info" = "log") => {
  console[logLevel](log);
};

/**
 * The object used to initialize an empty simnet session with, when no remote
 * data is enabled in the `Clarinet.toml` file.
 */
export const noRemoteData = {
  enabled: false,
  api_url: "",
  initial_height: 1,
};

export const invalidRemoteDataErrorMessage = `Remote data settings not properly setup in Clarinet.toml! To use remote data, please provide the "api_url", "initial_height", and "enabled' fields under the "repl.remote_data" section in the Clarinet.toml file.`;

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

export const parseRemoteDataSettings = (
  manifestPath: string,
  radio: EventEmitter
) => {
  const clarinetToml = toml.parse(readFileSync(resolve(manifestPath), "utf-8"));
  const remoteDataUserSettings = clarinetToml.repl
    ? clarinetToml.repl["remote_data"] || undefined
    : undefined;

  if (
    remoteDataUserSettings !== undefined &&
    (!remoteDataUserSettings["initial_height"] ||
      !remoteDataUserSettings["api_url"] ||
      !remoteDataUserSettings["enabled"])
  ) {
    throw new Error(invalidRemoteDataErrorMessage);
  }

  if (remoteDataUserSettings) {
    radio.emit(
      "logMessage",
      yellow(
        "\nUsing mainnet data. Setting the fuzzing environment will take a while..."
      )
    );
  }

  return remoteDataUserSettings || noRemoteData;
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
    --dial – The path to a JavaScript file containing custom pre- and post-execution functions (dialers).
    --help - Show the help message.
  `;

const parseOptionalArgument = (argName: string) => {
  return process.argv
    .find(
      (arg, idx) => idx >= 4 && arg.toLowerCase().startsWith(`--${argName}`)
    )
    ?.split("=")[1];
};

export async function main() {
  const radio = new EventEmitter();
  radio.on("logMessage", (log) => logger(log));
  radio.on("logFailure", (log) => logger(red(log), "error"));

  const args = process.argv;
  if (args.includes("--help")) {
    radio.emit("logMessage", helpMessage);
    return;
  }

  /** The relative path to the Clarinet project. */
  const manifestDir = args[2];
  if (!manifestDir || manifestDir.startsWith("--")) {
    radio.emit(
      "logMessage",
      red(
        "\nNo path to Clarinet project provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities."
      )
    );
    radio.emit("logMessage", helpMessage);
    return;
  }

  /** The target contract name. */
  const sutContractName = args[3];
  if (!sutContractName || sutContractName.startsWith("--")) {
    radio.emit(
      "logMessage",
      red(
        "\nNo target contract name provided. Please provide the contract name to be fuzzed."
      )
    );
    radio.emit("logMessage", helpMessage);
    return;
  }

  const type = args[4]?.toLowerCase();
  if (!type || type.startsWith("--") || !["test", "invariant"].includes(type)) {
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
    manifestDir,
    getManifestFileName(manifestDir, sutContractName)
  );
  radio.emit("logMessage", `Using manifest path: ${manifestPath}`);
  radio.emit("logMessage", `Target contract: ${sutContractName}`);

  const seed = parseInt(parseOptionalArgument("seed")!, 10) || undefined;
  if (seed !== undefined) {
    radio.emit("logMessage", `Using seed: ${seed}`);
  }

  const path = parseOptionalArgument("path") || undefined;
  if (path !== undefined) {
    radio.emit("logMessage", `Using path: ${path}`);
  }

  const runs = parseInt(parseOptionalArgument("runs")!, 10) || undefined;
  if (runs !== undefined) {
    radio.emit("logMessage", `Using runs: ${runs}`);
  }

  /**
   * The path to the dialer file. The dialer file allows the user to register
   * custom pre and post-execution JavaScript functions to be executed before
   * and after the public function calls during invariant testing.
   */
  const dialPath = parseOptionalArgument("dial") || undefined;
  if (dialPath !== undefined) {
    radio.emit("logMessage", `Using dial path: ${dialPath}`);
  }

  /**
   * The dialer registry, which is used to keep track of all the custom dialers
   * registered by the user using the `--dial` flag.
   */
  const dialerRegistry =
    dialPath !== undefined ? new DialerRegistry(dialPath) : undefined;

  if (dialerRegistry !== undefined) {
    dialerRegistry.registerDialers();
  }

  const remoteDataSettings = parseRemoteDataSettings(manifestPath, radio);

  const simnet = await issueFirstClassCitizenship(
    manifestDir,
    manifestPath,
    sutContractName,
    remoteDataSettings
  );

  /**
   * The list of contract IDs for the SUT contract names, as per the simnet.
   */
  const rendezvousList = Array.from(
    getSimnetDeployerContractsInterfaces(simnet).keys()
  ).filter((deployedContract) =>
    [sutContractName].includes(getContractNameFromContractId(deployedContract))
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
  switch (type) {
    case "invariant": {
      await checkInvariants(
        simnet,
        sutContractName,
        rendezvousList,
        rendezvousAllFunctions,
        seed,
        path,
        runs,
        dialerRegistry,
        radio
      );
      break;
    }

    case "test": {
      checkProperties(
        simnet,
        sutContractName,
        rendezvousList,
        rendezvousAllFunctions,
        seed,
        path,
        runs,
        radio
      );
      break;
    }
  }
}

if (require.main === module) {
  main();
}
