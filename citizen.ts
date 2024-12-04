import { readFileSync } from "fs";
import { join } from "path";
import yaml from "yaml";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { EpochString } from "@hirosystems/clarinet-sdk-wasm";

/**
 * Prepares the simnet environment and assures the target contract is treated
 * as a first-class citizen. This function handles:
 * - Contracts sorting by epoch based on the deployment plan.
 * - Combining the target contract with its tests and deploying all contracts
 *   to the simnet.
 *
 * @param manifestDir - The relative path to the manifest directory.
 * @param sutContractName - The target contract name.
 * @returns The initialized simnet instance with all contracts deployed, with
 * the target contract treated as a first-class citizen.
 */
export const issueFirstClassCitizenship = async (
  manifestDir: string,
  sutContractName: string
) => {
  const manifestPath = join(manifestDir, "Clarinet.toml");

  // Initialize the simnet, which generates the simnet plan and instance.
  // Later, an empty session will be set up, and contracts will be deployed
  // in the proper order based on the simnet plan.
  const simnet = await initSimnet(manifestPath);

  const simnetPlan = yaml.parse(
    readFileSync(join(manifestDir, "deployments", "default.simnet-plan.yaml"), {
      encoding: "utf-8",
    })
  );

  const sortedContractsByEpoch =
    groupContractsByEpochFromSimnetPlan(simnetPlan);

  await simnet.initEmtpySession();

  const sutContractNames = [sutContractName];

  // Combine the target contract with its tests into a single contract.
  // The resulting contract will replace the target contract in the simnet.
  // This map stores the contract name and its corresponding source code for
  // O(1) lookup.
  const rendezvousSources = new Map(
    sutContractNames
      .map((contractId) =>
        buildRendezvousData(simnetPlan, contractId, manifestDir)
      )
      .map((rendezvousContractData) => [
        rendezvousContractData.rendezvousContractName,
        rendezvousContractData.rendezvousSource,
      ])
  );

  // Deploy the contracts to the simnet in the correct order.
  await deployContracts(simnet, sortedContractsByEpoch, (name, props) =>
    getContractSource(
      sutContractNames,
      rendezvousSources,
      name,
      props,
      manifestDir
    )
  );

  return simnet;
};

/**
 * Groups contracts by epoch from the simnet plan.
 * @param simnetPlan - The simnet plan.
 * @returns A record of contracts grouped by epoch.
 */
const groupContractsByEpochFromSimnetPlan = (
  simnetPlan: any
): Record<string, Record<string, any>[]> => {
  return simnetPlan.plan.batches.reduce(
    (
      acc: Record<string, Record<string, any>[]>,
      batch: { epoch: string; transactions: any[] }
    ) => {
      const epoch = batch.epoch;
      const contracts = batch.transactions
        .filter((tx) => tx["emulated-contract-publish"])
        .map((tx) => {
          const contract = tx["emulated-contract-publish"];
          return {
            [contract["contract-name"]]: {
              path: contract.path,
              clarity_version: contract["clarity-version"],
            },
          };
        });

      if (contracts.length > 0) {
        acc[epoch] = (acc[epoch] || []).concat(contracts);
      }

      return acc;
    },
    {}
  );
};

/**
 * Deploy the contracts to the simnet in the correct order.
 * @param simnet - The simnet instance.
 * @param contractsByEpoch - The record of contracts by epoch.
 * @param getContractSourceFn - The function to retrieve the contract source.
 */
const deployContracts = async (
  simnet: any,
  contractsByEpoch: Record<string, any>,
  getContractSourceFn: (name: string, props: any) => string
) => {
  for (const [epoch, contracts] of Object.entries(contractsByEpoch)) {
    // Move to the next epoch and deploy the contracts in the correct order.
    simnet.setEpoch(epoch as EpochString);
    for (const contract of contracts.flatMap(Object.entries)) {
      const [name, props]: [
        string,
        { path: string; clarity_version: 1 | 2 | 3 }
      ] = contract;

      const source = getContractSourceFn(name, props);

      // For requirement contracts, use the original sender. The sender address
      // is included in the path:
      // "./.cache/requirements/<address>.contract-name.clar".
      const sender = props.path.includes(".cache")
        ? props.path.split("requirements")[1].slice(1).split(".")[0]
        : simnet.deployer;

      simnet.deployContract(
        name,
        source,
        { clarityVersion: props.clarity_version },
        sender
      );
    }
  }
};

/**
 * Conditionally retrieve the contract source based on whether the contract is
 * a SUT contract or not.
 * @param sutContractNames - The list of SUT contract names.
 * @param rendezvousMap - The rendezvous map.
 * @param contractName - The contract name.
 * @param contractProps - The contract properties.
 * @param manifestDir - The relative path to the manifest directory.
 * @returns The contract source.
 */
const getContractSource = (
  sutContractNames: string[],
  rendezvousMap: Map<string, string>,
  contractName: string,
  contractProps: any,
  manifestDir: string
): string => {
  if (sutContractNames.includes(contractName)) {
    const contractSource = rendezvousMap.get(contractName);
    if (!contractSource) {
      throw new Error(`Contract source not found for ${contractName}`);
    }
    return contractSource;
  } else {
    return readFileSync(join(manifestDir, contractProps.path), {
      encoding: "utf-8",
    });
  }
};

/**
 * Build the Rendezvous data.
 * @param simnetPlan The parsed simnet plan.
 * @param contractName The contract name.
 * @param manifestDir The relative path to the manifest directory.
 * @returns The Rendezvous data representing an object. The returned object
 * contains the Rendezvous source code and the Rendezvous contract name.
 */
export const buildRendezvousData = (
  simnetPlan: any,
  contractName: string,
  manifestDir: string
) => {
  try {
    const sutContractSource = getSimnetPlanContractSource(
      simnetPlan,
      manifestDir,
      contractName
    );

    const testContractSource = getTestContractSource(
      join(manifestDir, "contracts"),
      contractName
    );

    const rendezvousSource = scheduleRendezvous(
      sutContractSource!,
      testContractSource
    );

    return {
      rendezvousSource: rendezvousSource,
      rendezvousContractName: contractName,
    };
  } catch (e: any) {
    throw new Error(
      `Error processing contract ${contractName.split(".")[1]}: ${e.message}`
    );
  }
};

/**
 * Get contract source code from the simnet plan.
 * @param simnetPlan The parsed simnet plan.
 * @param manifestDir The relative path to the manifest directory.
 * @param sutContractName The target contract name.
 * @returns The contract source code.
 */
export const getSimnetPlanContractSource = (
  simnetPlan: any,
  manifestDir: string,
  sutContractName: string
) => {
  // Filter for transactions that contain "emulated-contract-publish"
  const contractInfo = simnetPlan.plan.batches
    .flatMap((batch: any) => batch.transactions)
    .find(
      (transaction: any) =>
        transaction["emulated-contract-publish"] &&
        transaction["emulated-contract-publish"]["contract-name"] ===
          sutContractName
    )?.["emulated-contract-publish"];

  if (contractInfo == undefined) {
    throw new Error(
      `Contract ${sutContractName} not found in the Clarinet.toml.`
    );
  }

  return readFileSync(join(manifestDir, contractInfo.path), {
    encoding: "utf-8",
  }).toString();
};

/**
 * Get the test contract source code.
 * @param contractsPath The relative path to the contracts directory.
 * @param sutContractName The target contract name.
 * @returns The test contract source code.
 */
export const getTestContractSource = (
  contractsPath: string,
  sutContractName: string
) => {
  // FIXME: Here, we can encounter a failure if the contract file name is
  // not the same as the contract name in the manifest.
  // Example:
  // - Contract name in the manifest: [contracts.counter-xyz]
  // - Contract file name: path = "contracts/counter.clar"
  const testContractName = `${sutContractName}.tests.clar`;
  const testContractPath = join(contractsPath, testContractName);
  try {
    return readFileSync(testContractPath, { encoding: "utf-8" }).toString();
  } catch (e: any) {
    throw new Error(
      `Error retrieving the corresponding test contract for the "${sutContractName}" contract. ${e.message}`
    );
  }
};

/**
 * Schedule a Rendezvous between the System Under Test (`SUT`) and the
 * invariants.
 * @param sutContractSource The SUT contract source code.
 * @param invariants The invariants contract source code.
 * @returns The Rendezvous source code.
 */
export function scheduleRendezvous(
  sutContractSource: string,
  invariants: string
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

  return `${sutContractSource}\n\n${context}\n\n${invariants}`;
}
