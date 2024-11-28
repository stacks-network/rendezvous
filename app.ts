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
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import toml, { JsonMap } from "@iarna/toml";

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

  const manifestDir = args[2];
  if (!manifestDir || manifestDir.startsWith("--")) {
    radio.emit(
      "logMessage",
      "\nNo path to Clarinet project provided. Supply it immediately or face the relentless scrutiny of your contract's vulnerabilities."
    );
    radio.emit("logMessage", helpMessage);
    return;
  }

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

  const initialSimnet = await initSimnet(manifestPath);

  // FIXME: Get all the contracts and not only the deployer ones. This way the
  // requirement contracts could be tested as well.
  // e.g.: we want to test a contract that is already deployed on testnet.
  const initialSimnetContracts = Array.from(
    // FIXME: simnet.getContractInterfaces().keys()
    getSimnetDeployerContractsInterfaces(initialSimnet).keys()
  );

  const sutContractIds = initialSimnetContracts.filter(
    // FIXME: Allow any contract from the environment to be tested. To do this,
    // we need to pass the FQN of the contract and remove the default deployer
    // address.
    (deployedContract) =>
      deployedContract === `${initialSimnet.deployer}.${sutContractName}`
  );

  if (sutContractIds.length === 0) {
    throw new Error(
      `The "${sutContractName}" contract was not found in the network.`
    );
  }

  const contractsPath = join(manifestDir, "contracts");

  // The following steps replace the target contract with the combined one and
  // re-initialize the simnet with the updated manifest. This turns the tests
  // into real first class citizens of the target contract.

  // 1. Combine the contract with its tests.
  const rendezvousData = sutContractIds.map((contractId) =>
    buildRendezvousData(initialSimnet, contractId, contractsPath)
  );

  // 2. Create a temporary directory and write the combined contract to a
  // file. The simnet will use this temporary file for the target contract.
  const tmpDir = join(manifestDir, "tmp");
  mkdirSync(tmpDir, { recursive: true });

  const tmpRendezvousPaths = rendezvousData.map((contractData) => {
    const tmpRendezvousPath = join(
      tmpDir,
      `${contractData.rendezvousFileName}.clar`
    );
    writeFileSync(tmpRendezvousPath, contractData.rendezvousSource);
    return join("tmp", `${contractData.rendezvousFileName}.clar`);
  });

  // 3. Parse the Clarinet.toml. The target contract's path will be replaced
  // with the temporary file path in the next step.
  const clarinetToml = toml.parse(readFileSync(manifestPath, "utf-8")) as {
    project: object;
    contracts: { [key: string]: { path: string; epoch?: number | string } };
  };

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

  // 4. Update the target contract entry in Clarinet.toml with the temporary
  // file path.
  rendezvousData
    .map((contractData, index) => ({
      rendezvousContractName: contractData.rendezvousContractName,
      rendezvousContractTmpPath: tmpRendezvousPaths[index],
    }))
    .forEach(({ rendezvousContractName, rendezvousContractTmpPath }) => {
      clarinetToml.contracts[rendezvousContractName]["path"] =
        rendezvousContractTmpPath;
    });

  // 5. Save the modified Clarinet.toml to a temporary file. This is required
  // for initializing the simnet with the updated manifest.
  const tmpTomlPath = join(manifestDir, "Clarinet-tmp.toml");
  writeFileSync(tmpTomlPath, toml.stringify(clarinetToml as JsonMap));

  // 6. Initialize the simnet using the updated Clarinet.toml file.
  const simnet = await initSimnet(tmpTomlPath);

  // 7. Clean up by removing the temporary directory and Clarinet.toml file.
  rmSync(tmpTomlPath, { force: true });
  rmSync(tmpDir, { recursive: true, force: true });

  const rendezvousAllFunctions = getFunctionsFromContractInterfaces(
    new Map(
      Array.from(getSimnetDeployerContractsInterfaces(simnet)).filter(
        ([contractId]) => sutContractIds.includes(contractId)
      )
    )
  );

  const rendezvousList = rendezvousData.map((contractData) => {
    return contractData.rendezvousContractId;
  });
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
