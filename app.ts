// Single file (app.ts) is flexible, keeps git history clean. Better early on.
// Multiple files improve organization, readability, and collaboration as the project grows.
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { join } from "path";
import { EventEmitter } from "events";
import { checkProperties } from "./property";
import { checkInvariants } from "./invariant";
import { getSimnetDeployerContractsInterfaces } from "./shared";

const logger = (log: string, logLevel: "log" | "error" | "info" = "log") => {
  console[logLevel](log);
};

const helpMessage = `
  Usage: ./rv <path-to-clarinet-project> <contract-name> [--type=<type>] [--seed=<seed>] [--path=<path>]

  Positional arguments:
    path-to-clarinet-project - The path to the Clarinet project.
    contract-name - The name of the contract to be fuzzed.

  Options:
    --seed - The seed to use for the replay functionality.
    --path - The path to use for the replay functionality.
    --type - The type to use for exercising the contracts. Possible values: test, invariant. Default: invariant.
    --help - Show the help message.
  `;

const parseOptionalCommandLineArgument = (argName: string) => {
  return process.argv
    .find(
      (arg, index) => index >= 4 && arg.toLowerCase().startsWith(`--${argName}`)
    )
    ?.split("=")[1];
};

export async function main() {
  const radio = new EventEmitter();
  radio.on("logMessage", (log) => logger(log));
  radio.on("logFailure", (log) => logger(log, "error"));

  // Get the arguments from the command-line.
  const args = process.argv;

  if (args.includes("--help")) {
    radio.emit("logMessage", helpMessage);
    return;
  }

  const seed =
    parseInt(parseOptionalCommandLineArgument("seed")!, 10) || undefined;
  if (seed !== undefined) {
    radio.emit("logMessage", `Using seed: ${seed}`);
  }

  const path = parseOptionalCommandLineArgument("path") || undefined;
  if (path !== undefined) {
    radio.emit("logMessage", `Using path: ${path}`);
  }

  const type = parseOptionalCommandLineArgument("type") || "invariant";

  if (type !== "invariant" && type !== "test") {
    radio.emit(
      "logFailure",
      `Invalid type of testing: ${type}. Possible values: test, invariant.`
    );
    radio.emit("logMessage", helpMessage);
    return;
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

  const simnetContractsInterfaces =
    getSimnetDeployerContractsInterfaces(simnet);

  // Get all the contracts from the interfaces.
  const simnetContractIds = Array.from(simnetContractsInterfaces.keys());

  const sutContractId = `${simnet.deployer}.${sutContractName}`;

  const sutContractIds = simnetContractIds.filter(
    (contract) => contract === sutContractId
  );

  // Check if the SUT contract is in the network.
  if (sutContractIds.length === 0) {
    throw new Error(
      `The "${sutContractName}" contract was not found in the network.`
    );
  }

  const contractsPath = join(manifestDir, "contracts");

  // This is the junction where the magic happens. The type of testing
  // will start based on the default or user-provided testing type.
  switch (type) {
    case "invariant": {
      checkInvariants(
        simnet,
        contractsPath,
        sutContractName,
        sutContractIds,
        seed,
        path,
        radio
      );
      break;
    }
    case "test": {
      checkProperties(
        simnet,
        contractsPath,
        sutContractName,
        sutContractIds,
        seed,
        path,
        radio
      );
      break;
    }
  }
}

if (require.main === module) {
  main();
}
