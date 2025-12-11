import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from "fs";
import { join, relative, basename } from "path";
import { tmpdir } from "os";
import { parse as parseToml, stringify as stringifyToml } from "@iarna/toml";
import yaml from "yaml";
import { initSimnet, Simnet } from "@stacks/clarinet-sdk";
import {
  Batch,
  EmulatedContractPublish,
  DeploymentPlan,
  Transaction,
} from "./citizen.types";
import { EpochString } from "@stacks/clarinet-sdk-wasm";
import EventEmitter from "events";

/**
 * Prepares the simnet with the Rendezvous tests as first-class citizens of the
 * target contract.
 *
 * This function works in an isolated temporary copy of the Clarinet project
 * in /tmp/ to avoid lingering temporary files in the user's project directory.
 * In case of system crashes, power outages, etc., the temp directory is
 * automatically cleaned up by the OS on reboot.
 *
 * @param manifestDir The relative path to the manifest directory.
 * @param manifestPath The path to the manifest file.
 * @param sutContractName The target contract name.
 * @param radio The event emitter to send log messages to.
 * @returns The initialized simnet.
 */
export const issueFirstClassCitizenship = async (
  manifestDir: string,
  manifestPath: string,
  sutContractName: string,
  radio: EventEmitter
): Promise<Simnet> => {
  // First simnet initialization: This will generate the deployment plan and
  // will type check the project without any Rendezvous tests.
  try {
    radio.emit("logMessage", `Type-checking your Clarinet project...`);
    await initSimnetSilently(manifestPath);
  } catch (error: any) {
    throw new Error(`Error initializing simnet: ${error.message ?? error}`);
  }

  const deploymentPlan = yaml.parse(
    readFileSync(join(manifestDir, "deployments", "default.simnet-plan.yaml"), {
      encoding: "utf-8",
    })
  ) as DeploymentPlan;

  const parsedManifest = parseToml(
    readFileSync(manifestPath, { encoding: "utf-8" })
  ) as any;
  const cacheDir = parsedManifest.project?.cache_dir ?? "./.cache";

  const rendezvousData = buildRendezvousData(
    cacheDir,
    deploymentPlan,
    sutContractName,
    manifestDir
  );

  // Create isolated temp directory for the Rendezvous testing run.
  const tempProjectDir = mkdtempSync(join(tmpdir(), "rendezvous-run-"));
  cpSync(manifestDir, tempProjectDir, { recursive: true });

  const [, contractName] = rendezvousData.rendezvousContractId.split(".");
  const rendezvousContractsDir = join(tempProjectDir, "contracts");
  const rendezvousPath = join(
    rendezvousContractsDir,
    `${contractName}-rendezvous.clar`
  );
  writeFileSync(rendezvousPath, rendezvousData.rendezvousSourceCode);

  radio.emit("logMessage", `\nType-checking your Rendezvous project...`);

  // Update the manifest in the temp directory to point to the Rendezvous
  // concatenation.
  const manifestFileName = basename(manifestPath);
  const tempManifestPath = join(tempProjectDir, manifestFileName);
  const tempParsedManifest = parseToml(
    readFileSync(tempManifestPath, { encoding: "utf-8" })
  ) as any;

  if (!tempParsedManifest.contracts) {
    tempParsedManifest.contracts = {};
  }
  if (!tempParsedManifest.contracts[sutContractName]) {
    tempParsedManifest.contracts[sutContractName] = {};
  }

  const relativeRendezvousPath = relative(tempProjectDir, rendezvousPath);
  tempParsedManifest.contracts[sutContractName] = {
    epoch: (tempParsedManifest.contracts[sutContractName].epoch ??
      "latest") as EpochString,
    path: relativeRendezvousPath,
  };

  // Convert epoch values to strings for TOML compatibility.
  for (const contractName in tempParsedManifest.contracts) {
    const contract = tempParsedManifest.contracts[contractName];
    if (contract?.epoch && typeof contract.epoch === "number") {
      contract.epoch = String(contract.epoch);
    }
  }

  writeFileSync(tempManifestPath, stringifyToml(tempParsedManifest));

  // Final simnet initialization: This will initialize the simnet with the
  // target contract containing Rendezvous tests as first-class citizens.
  //
  // Windows cannot initialize simnet with absolute paths. Use relative path
  // from the temp project directory.
  // See: https://github.com/stx-labs/clarinet/issues/1634
  const originalCwd = process.cwd();
  try {
    // Change the current working directory to the temp project directory.
    // This is necessary because the simnet initialization requires the
    // manifest file to be in the current working directory.
    process.chdir(tempProjectDir);
    const simnet = await initSimnetSilently(manifestFileName);
    return simnet;
  } finally {
    // Restore the original current working directory.
    process.chdir(originalCwd);
    // Cleanup the temp project directory.
    rmSync(tempProjectDir, { recursive: true, force: true });
  }
};

/**
 * Initializes the simnet silently by suppressing stdout. Errors are still
 * printed to stderr to help troubleshoot issues.
 * @param manifestPath The path to the manifest file.
 * @returns The initialized simnet.
 */
const initSimnetSilently = async (manifestPath: string): Promise<Simnet> => {
  const originalWrite = process.stdout.write;
  // Suppress stdout to avoid polluting output.
  process.stdout.write = () => true;
  try {
    return await initSimnet(manifestPath);
  } finally {
    // Restore stdout.
    process.stdout.write = originalWrite;
  }
};

/**
 * Builds the Rendezvous data.
 * @param cacheDir The cache directory path.
 * @param deploymentPlan The parsed deployment plan.
 * @param contractName The contract name.
 * @param manifestDir The relative path to the manifest directory.
 * @returns The Rendezvous data representing a record. The returned record
 * contains the Rendezvous source code and the unique Rendezvous contract ID.
 */
export const buildRendezvousData = (
  cacheDir: string,
  deploymentPlan: DeploymentPlan,
  contractName: string,
  manifestDir: string
): { rendezvousContractId: string; rendezvousSourceCode: string } => {
  try {
    const sutContractSource = getDeploymentPlanContractSource(
      deploymentPlan,
      contractName,
      manifestDir
    );

    const testContractSource = getTestContractSource(
      cacheDir,
      deploymentPlan,
      contractName,
      manifestDir
    );

    const rendezvousSource = scheduleRendezvous(
      sutContractSource!,
      testContractSource
    );

    const rendezvousContractEmulatedSender =
      getSutContractDeploymentPlanEmulatedPublish(deploymentPlan, contractName)[
        "emulated-sender"
      ];

    // Use the contract ID as a unique identifier of the contract within the
    // deployment plan.
    const rendezvousContractId = `${rendezvousContractEmulatedSender}.${contractName}`;

    return {
      rendezvousContractId: rendezvousContractId,
      rendezvousSourceCode: rendezvousSource,
    };
  } catch (error: any) {
    throw new Error(
      `Error processing "${contractName}" contract: ${error.message}`
    );
  }
};

/**
 * Retrieves the contract source code using the deployment plan.
 * @param deploymentPlan The parsed deployment plan.
 * @param sutContractName The target contract name.
 * @param manifestDir The relative path to the manifest directory.
 * @returns The contract source code.
 */
const getDeploymentPlanContractSource = (
  deploymentPlan: DeploymentPlan,
  sutContractName: string,
  manifestDir: string
) => {
  const sutContractPath = getSutContractDeploymentPlanEmulatedPublish(
    deploymentPlan,
    sutContractName
  ).path;

  return readFileSync(join(manifestDir, sutContractPath), {
    encoding: "utf-8",
  }).toString();
};

/**
 * Retrieves the emulated contract publish data of the target contract from the
 * deployment plan. If multiple contracts share the same name in the deployment
 * plan, this utility will prioritize the one defined in `Clarinet.toml` as a
 * project contract over a requirement. The prioritization is made comparing
 * the deployment plan emulated sender with the deployer of the Clarinet project.
 * @param deploymentPlan The parsed deployment plan.
 * @param sutContractName The target contract name.
 * @returns The emulated contract publish data of the SUT contract as present
 * in the deployment plan.
 */
const getSutContractDeploymentPlanEmulatedPublish = (
  deploymentPlan: DeploymentPlan,
  sutContractName: string
): EmulatedContractPublish => {
  // Filter all emulated contract publish transactions matching the target
  // contract name from the deployment plan.
  const contractPublishMatchesByName = deploymentPlan.plan.batches
    .flatMap((batch: Batch) => batch.transactions)
    .filter(
      (transaction: Transaction) =>
        transaction["emulated-contract-publish"] &&
        transaction["emulated-contract-publish"]["contract-name"] ===
          sutContractName
    );

  // If no matches are found, something went wrong.
  if (contractPublishMatchesByName.length === 0) {
    throw new Error(
      `"${sutContractName}" contract not found in Clarinet.toml.`
    );
  }

  // If multiple matches are found, search for the one deployed by the deployer
  // defined in the `Devnet.toml` file and present in the deployment plan. This
  // is the project contract.
  if (contractPublishMatchesByName.length > 1) {
    const deployer = deploymentPlan.genesis.wallets.find(
      (wallet) => wallet.name === "deployer"
    )?.address;

    if (!deployer) {
      throw new Error(
        `Something went wrong. Deployer not found in the deployment plan.`
      );
    }

    // From the list of filtered emulated contract publish transactions with
    // having the same name, select the one deployed by the deployer.
    const targetContractDeploymentData = contractPublishMatchesByName.find(
      (transaction: Transaction) =>
        transaction["emulated-contract-publish"]!["emulated-sender"]! ===
        deployer
    )?.["emulated-contract-publish"];

    // TODO: Consider handling requirements and project contracts separately.
    // Eventually let the user specify if the contract is a requirement or a
    // project contract.

    // This is an edge case that can happen in practice. If the project has two
    // requirements that share the same contract name, Rendezvous will not be
    // able to select the one to be fuzzed. The recommendation for users would
    // be to include the target contract in the Clarinet project.
    if (!targetContractDeploymentData) {
      throw new Error(
        `Multiple contracts named "${sutContractName}" found in the deployment plan, no one deployed by the deployer.`
      );
    }

    return targetContractDeploymentData;
  }

  // Only one match was found, return the path to the contract.
  const contractNameMatch =
    contractPublishMatchesByName[0]["emulated-contract-publish"];

  if (!contractNameMatch) {
    throw new Error(`Could not locate "${sutContractName}" contract.`);
  }

  return contractNameMatch;
};

/**
 * Retrieves the test contract source code for a project contract.
 * @param contractPath The relative path to the contract.
 * @param manifestDir The relative path to the manifest directory.
 * @returns The test contract source code or `null` if the test contract is not
 * found.
 */
const getProjectContractTestSrc = (
  contractPath: string,
  manifestDir: string
): string | null => {
  const clarityExtension = ".clar";
  const lastExtensionIndex = contractPath.lastIndexOf(clarityExtension);
  const testContractPath =
    lastExtensionIndex !== -1
      ? contractPath.slice(0, lastExtensionIndex) +
        `.tests${clarityExtension}` +
        contractPath.slice(lastExtensionIndex + clarityExtension.length)
      : `${contractPath}.tests${clarityExtension}`;

  try {
    const fullPath = join(manifestDir, testContractPath);
    const content = readFileSync(fullPath, {
      encoding: "utf-8",
    }).toString();
    return content;
  } catch (error: any) {
    return null;
  }
};

/**
 * Retrieves the test contract source code for a requirement contract. It
 * searches for the test contract in the `contracts` directory of the Clarinet
 * project.
 * @param cacheDir The cache directory path.
 * @param sutContractPath The path to the SUT contract.
 * @param manifestDir The relative path to the manifest directory.
 * @returns The test contract source code or `null` if the test contract is not
 * found.
 */
const getRequirementContractTestSrc = (
  cacheDir: string,
  sutContractPath: string,
  manifestDir: string
): string | null => {
  const normalizedCacheDir = cacheDir.replace(/[\/\\]$/, "");
  const requirementsRelativePath = `${normalizedCacheDir}/requirements/`;

  if (!sutContractPath.includes(requirementsRelativePath)) {
    return null;
  }

  const relativePath = sutContractPath.split(requirementsRelativePath)[1];

  const clarityExtension = ".clar";
  const lastExtensionIndex = relativePath.lastIndexOf(clarityExtension);
  const relativePathTestContract =
    lastExtensionIndex !== -1
      ? relativePath.slice(0, lastExtensionIndex) +
        `.tests${clarityExtension}` +
        relativePath.slice(lastExtensionIndex + clarityExtension.length)
      : `${relativePath}.tests${clarityExtension}`;

  return readFileSync(
    join(manifestDir, "contracts", relativePathTestContract),
    {
      encoding: "utf-8",
    }
  ).toString();
};

/**
 * Retrieves the test contract source code.
 * Project contracts have priority. Requirement contracts are only checked
 * if project contract test is not found.
 * @param cacheDir The cache directory path.
 * @param deploymentPlan The parsed deployment plan.
 * @param sutContractName The target contract name.
 * @param manifestDir The relative path to the manifest directory.
 * @returns The test contract source code.
 */
export const getTestContractSource = (
  cacheDir: string,
  deploymentPlan: DeploymentPlan,
  sutContractName: string,
  manifestDir: string
): string => {
  const sutContractPath = getSutContractDeploymentPlanEmulatedPublish(
    deploymentPlan,
    sutContractName
  ).path;

  // Prioritize project contracts. Try project contract test first.
  const projectTestContract = getProjectContractTestSrc(
    sutContractPath,
    manifestDir
  );
  if (projectTestContract !== null) {
    return projectTestContract;
  }

  // Fallback to requirement contract test if project contract test not found.
  const normalizedCacheDir = cacheDir || "./.cache";
  const requirementTestContract = getRequirementContractTestSrc(
    normalizedCacheDir,
    sutContractPath,
    manifestDir
  );
  if (requirementTestContract !== null) {
    return requirementTestContract;
  }

  // No corresponding test contract was found for the SUT contract.
  throw new Error(
    `Error retrieving the corresponding test contract for the "${sutContractName}" contract.`
  );
};

/**
 * Schedules a Rendezvous between the System Under Test (`SUT`) and the test
 * contract.
 * @param targetContractSource The target contract source code.
 * @param tests The corresponding test contract source code.
 * @returns The Rendezvous source code.
 */
export function scheduleRendezvous(
  targetContractSource: string,
  tests: string
): string {
  /**
   * The `context` map tracks how many times each function has been called.
   * This data can be useful for invariant tests to check behavior over time.
   */
  const context = `(define-map context (string-ascii 100) {
    called: uint
    ;; other data
  })

  (define-public (update-context (function-name (string-ascii 100)) (called uint))
    (ok (map-set context function-name {called: called})))`;

  return `${targetContractSource}\n\n${context}\n\n${tests}`;
}
