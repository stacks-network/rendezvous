import { initSimnet } from "@hirosystems/clarinet-sdk";
import { join } from "path";
import { EventEmitter } from "events";
import { checkProperties } from "./property";
import { checkInvariants } from "./invariant";
import {
  buildRendezvousData,
  deployRendezvous,
  filterRendezvousInterfaces,
  getFunctionsFromContractInterfaces,
  getSimnetDeployerContractsInterfaces,
} from "./shared";

const logger = (log: string, logLevel: "log" | "error" | "info" = "log") => {
  console[logLevel](log);
};

const helpMessage = `
  Usage: ./rv <path-to-clarinet-project> <contract-name> [--type=<type>] [--seed=<seed>] [--path=<path>] [--runs=<runs>]

  Positional arguments:
    path-to-clarinet-project - The path to the Clarinet project.
    contract-name - The name of the contract to be fuzzed.

  Options:
    --seed - The seed to use for the replay functionality.
    --path - The path to use for the replay functionality.
    --type - The type to use for exercising the contracts. Possible values: test, invariant. Default: invariant.
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
  radio.on("logFailure", (log) => logger(log, "error"));

  const args = process.argv;
  if (args.includes("--help")) {
    radio.emit("logMessage", helpMessage);
    return;
  }

  const seed = parseInt(parseOptionalArgument("seed")!, 10) || undefined;
  if (seed !== undefined) {
    radio.emit("logMessage", `Using seed: ${seed}`);
  }

  const path = parseOptionalArgument("path") || undefined;
  if (path !== undefined) {
    radio.emit("logMessage", `Using path: ${path}`);
  }

  const type = parseOptionalArgument("type")?.toLowerCase() || "invariant";
  if (type !== "invariant" && type !== "test") {
    radio.emit(
      "logFailure",
      `Invalid type of testing: ${type}. Possible values: test, invariant.`
    );
    radio.emit("logMessage", helpMessage);
    return;
  }

  const runs = parseInt(parseOptionalArgument("runs")!, 10) || undefined;
  if (runs !== undefined) {
    radio.emit("logMessage", `Using runs: ${runs}`);
  }

  const manifestDir = args[2];
  if (!manifestDir || manifestDir.startsWith("--")) {
    radio.emit(
      "logMessage",
      "\nNo path to Clarinet project provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities."
    );
    radio.emit("logMessage", helpMessage);
    return;
  }

  const manifestPath = join(manifestDir, "Clarinet.toml");
  radio.emit("logMessage", `Using manifest path: ${manifestPath}`);

  const sutContractName = args[3];
  if (!sutContractName || sutContractName.startsWith("--")) {
    radio.emit(
      "logMessage",
      "\nNo target contract name provided. Please provide the contract name to be fuzzed."
    );
    radio.emit("logMessage", helpMessage);
    return;
  }
  radio.emit("logMessage", `Target contract: ${sutContractName}`);

  const simnet = await initSimnet(manifestPath);

  const sutContractIds = Array.from(
    getSimnetDeployerContractsInterfaces(simnet).keys()
  ).filter(
    (deployedContract) =>
      deployedContract === `${simnet.deployer}.${sutContractName}`
  );

  if (sutContractIds.length === 0) {
    throw new Error(
      `The "${sutContractName}" contract was not found in the network.`
    );
  }

  const contractsPath = join(manifestDir, "contracts");

  const rendezvousList = sutContractIds
    .map((contractId) => buildRendezvousData(simnet, contractId, contractsPath))
    .map((contractData) => {
      deployRendezvous(
        simnet,
        contractData.rendezvousName,
        contractData.rendezvousSource
      );
      return contractData.rendezvousContractId;
    });

  const rendezvousAllFunctions = getFunctionsFromContractInterfaces(
    filterRendezvousInterfaces(getSimnetDeployerContractsInterfaces(simnet))
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
