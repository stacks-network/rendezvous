import { initSimnet } from "@hirosystems/clarinet-sdk";
import { join } from "path";
import { EventEmitter } from "events";
import { checkProperties } from "./property";
import { checkInvariants } from "./invariant";
import {
  buildRendezvousData,
  getFunctionsFromContractInterfaces,
  getSimnetDeployerContractsInterfaces,
} from "./shared";
import { readFileSync } from "fs";
import toml from "@iarna/toml";
import { EpochString } from "@hirosystems/clarinet-sdk-wasm";
import { ClarinetToml } from "./app.types";

const logger = (log: string, logLevel: "log" | "error" | "info" = "log") => {
  console[logLevel](log);
};

const helpMessage = `
  Usage: ./rv <path-to-clarinet-project> <contract-name> <type> [--seed=<seed>] [--path=<path>] [--runs=<runs>]

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
  radio.on("logFailure", (log) => logger(log, "error"));

  const args = process.argv;
  if (args.includes("--help")) {
    radio.emit("logMessage", helpMessage);
    return;
  }

  /** The relative path to the Clarinet project.*/
  const manifestDir = args[2];
  if (!manifestDir || manifestDir.startsWith("--")) {
    radio.emit(
      "logMessage",
      "\nNo path to Clarinet project provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities."
    );
    radio.emit("logMessage", helpMessage);
    return;
  }

  /** The target contract name. */
  const sutContractName = args[3];
  if (!sutContractName || sutContractName.startsWith("--")) {
    radio.emit(
      "logMessage",
      "\nNo target contract name provided. Please provide the contract name to be fuzzed."
    );
    radio.emit("logMessage", helpMessage);
    return;
  }

  const type = args[4]?.toLowerCase();
  if (!type || type.startsWith("--") || !["test", "invariant"].includes(type)) {
    radio.emit(
      "logMessage",
      "\nInvalid type provided. Please provide the type of test to be executed. Possible values: test, invariant."
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

  // Parse the Clarinet.toml file. Its contents are used to deploy contracts
  // to the simnet, with the combined contract source overwriting the target
  // contract's source in a later step.
  const clarinetToml = toml.parse(
    readFileSync(manifestPath, { encoding: "utf-8" })
  ) as ClarinetToml;

  // Stringify the epoch to 2 decimal places for `2.05`. Otherwise, stringify
  // to 1 decimal place.
  if (clarinetToml.contracts) {
    for (const key in clarinetToml.contracts) {
      const epoch = clarinetToml.contracts[key].epoch ?? undefined;
      if (epoch !== undefined && typeof epoch === "number") {
        if (epoch === 2.05) {
          clarinetToml.contracts[key].epoch = epoch.toFixed(2);
        } else {
          clarinetToml.contracts[key].epoch = epoch.toFixed(1);
        }
      }
    }
  }

  /** The list of the contracts names found in the Clarinet.toml */
  const manifestContracts = Array.from(Object.keys(clarinetToml.contracts));

  /** The filtered list of SUT contract names */
  const sutContractNames = manifestContracts.filter(
    (contractName) => contractName === sutContractName
  );

  if (sutContractNames.length === 0) {
    throw new Error(
      `The "${sutContractName}" contract was not found in the network.`
    );
  }

  /** The relative path to the contracts directory. */
  const contractsPath = join(manifestDir, "contracts");

  // Combine the contract with its tests. The combined contract will overwrite
  // the target contract in the simnet.
  const rendezvousData = sutContractNames.map((contractId) =>
    buildRendezvousData(clarinetToml, contractId, manifestDir, contractsPath)
  );
  const rendezvousMap = new Map(
    rendezvousData.map((rendezvousContractData) => [
      rendezvousContractData.rendezvousContractName,
      rendezvousContractData.rendezvousSource,
    ])
  );

  // Group the contracts by epoch.
  // If `epoch` is not specified, it will be overwritten with "2.0".
  // If `clarity_version` is not specified, it will be overwritten with 1.
  // FIXME: Find a way to determine the deployment order for contracts with
  // the same epoch.
  const contractsByEpoch = Object.entries(clarinetToml.contracts).reduce(
    (acc, [contractName, { path, epoch, clarity_version }]) => {
      const groupKey = epoch ?? "2.0";
      const clarityVersionString = (clarity_version ?? 1) as 1 | 2 | 3;

      return {
        ...acc,
        [groupKey]: [
          ...(acc[groupKey] || []),
          { [contractName]: { path, clarity_version: clarityVersionString } },
        ],
      };
    },
    {} as Record<
      string,
      Record<string, { path: string; clarity_version: 1 | 2 | 3 }>[]
    >
  );

  // Sort the entries by epoch. This is required for easily setting the epoch
  // deploying the contracts in the correct order.
  const sortedContractsByEpoch = Object.fromEntries(
    Object.entries(contractsByEpoch).sort(([epochA], [epochB]) =>
      epochA.localeCompare(epochB, undefined, { numeric: true })
    )
  );

  const simnet = await initSimnet(manifestPath);
  await simnet.initEmtpySession();

  const getContractSource = (
    contractName: string,
    contractProps: any
  ): string => {
    if (sutContractNames.includes(contractName)) {
      if (!rendezvousMap.get(contractName)) {
        throw new Error(`Contract source not found for ${contractName}`);
      } else {
        return rendezvousMap.get(contractName)!;
      }
    }
    switch (sutContractNames.includes(contractName)) {
      case true: {
        if (!rendezvousMap.get(contractName)) {
          throw new Error(`Contract source not found for ${contractName}`);
        }
        return rendezvousMap.get(contractName)!;
      }
      case false:
        return readFileSync(join(manifestDir, contractProps.path), "utf-8");
    }
  };

  Object.entries(sortedContractsByEpoch).forEach(([epoch, contracts]) => {
    simnet.setEpoch(epoch as EpochString);

    contracts
      .flatMap(Object.entries)
      .forEach(([contractName, contractProps]) => {
        console.log(contractName, contractProps);

        const contractSource = getContractSource(contractName, contractProps);

        simnet.deployContract(
          contractName,
          contractSource,
          { clarityVersion: contractProps.clarity_version },
          simnet.deployer
        );
      });
  });

  /**
   * The list of contract IDs for the SUT contract names, as per the simnet.
   */
  const sutContractIds = Array.from(
    getSimnetDeployerContractsInterfaces(simnet).keys()
  ).filter((deployedContract) =>
    sutContractNames.includes(deployedContract.split(".")[1])
  );

  const rendezvousAllFunctions = getFunctionsFromContractInterfaces(
    new Map(
      Array.from(getSimnetDeployerContractsInterfaces(simnet)).filter(
        ([contractId]) => sutContractIds.includes(contractId)
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
        sutContractIds,
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
        sutContractIds,
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
