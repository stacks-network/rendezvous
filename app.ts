#!/usr/bin/env node
import { join } from "path";
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

const logger = (log: string, logLevel: "log" | "error" | "info" = "log") => {
  console[logLevel](log);
};

const helpMessage = `
  rv v${version}
  
  Usage: rv <path-to-clarinet-project> <contract-name> <type> [--seed=<seed>] [--path=<path>] [--runs=<runs>]

  Positional arguments:
    path-to-clarinet-project - The path to the Clarinet project.
    contract-name - The name of the contract to be fuzzed.
    type - The type to use for exercising the contracts. Possible values: test, invariant.

  Options:
    --seed - The seed to use for the replay functionality.
    --path - The path to use for the replay functionality.
    --runs - The runs to use for iterating over the tests. Default: 100.
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

  /** The relative path to `Clarinet.toml`. */
  const manifestPath = join(manifestDir, "Clarinet.toml");
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

  const simnet = await issueFirstClassCitizenship(manifestDir, sutContractName);

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
      checkInvariants(
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
