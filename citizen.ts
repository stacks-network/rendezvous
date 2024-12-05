import { readFileSync } from "fs";
import { join } from "path";
import yaml from "yaml";
import { initSimnet, Simnet } from "@hirosystems/clarinet-sdk";
import { EpochString } from "@hirosystems/clarinet-sdk-wasm";
import { Batch, SimnetPlan, Transaction } from "./citizen.types";

/**
 * Prepares the simnet environment and assures the target contract is treated
 * as a first-class citizen, by combining it with its tests. This function
 * handles:
 * - Contract sorting by epoch based on the deployment plan.
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
): Promise<Simnet> => {
  const manifestPath = join(manifestDir, "Clarinet.toml");

  // Initialize the simnet, to generate the simnet plan and instance. The empty
  // session will be set up, and contracts will be deployed in the correct
  // order based on the simnet plan a few lines below.
  const simnet = await initSimnet(manifestPath);

  const simnetPlan = yaml.parse(
    readFileSync(join(manifestDir, "deployments", "default.simnet-plan.yaml"), {
      encoding: "utf-8",
    })
  );

  const sortedContractsByEpoch =
    groupContractsByEpochFromSimnetPlan(simnetPlan);

  await simnet.initEmtpySession();

  // Combine the target contract with its tests into a single contract.
  // The resulting contract will replace the target contract in the simnet.
  // This map stores the contract name and its corresponding source code for
  // O(1) lookup.
  const rendezvousSources = new Map(
    [sutContractName]
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
      [sutContractName],
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
 * @returns A record of contracts grouped by epoch. The record key is the epoch
 * string, and the value is an array of contracts. Each contract is represented
 * as a record with the contract name as the key and a record containing the
 * contract path and clarity version as the value.
 */
const groupContractsByEpochFromSimnetPlan = (
  simnetPlan: SimnetPlan
): Record<
  EpochString,
  Record<string, { path: string; clarity_version: string }>[]
> => {
  return simnetPlan.plan.batches.reduce(
    (
      acc: Record<
        EpochString,
        Record<string, { path: string; clarity_version: string }>[]
      >,
      batch: Batch
    ) => {
      const epoch = batch.epoch as EpochString;
      const contracts = batch.transactions
        .filter((tx) => tx["emulated-contract-publish"])
        .map((tx) => {
          const contract = tx["emulated-contract-publish"]!;
          return {
            [contract["contract-name"]]: {
              path: contract.path,
              clarity_version: contract["clarity-version"],
            },
          };
        });

      if (contracts.length > 0) {
        acc[epoch] = (acc[epoch] || []).concat(contracts as {});
      }

      return acc;
    },
    {} as Record<
      EpochString,
      Record<string, { path: string; clarity_version: string }>[]
    >
  );
};

/**
 * Deploy the contracts to the simnet in the correct order.
 * @param simnet - The simnet instance.
 * @param contractsByEpoch - The record of contracts by epoch.
 * @param getContractSourceFn - The function to retrieve the contract source.
 */
const deployContracts = async (
  simnet: Simnet,
  contractsByEpoch: Record<
    EpochString,
    Record<string, { path: string; clarity_version: string }>[]
  >,
  getContractSourceFn: (
    name: string,
    props: {
      path: string;
      clarity_version: 1 | 2 | 3;
    }
  ) => string
): Promise<void> => {
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
  contractProps: {
    path: string;
    clarity_version: 1 | 2 | 3;
  },
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
  simnetPlan: SimnetPlan,
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
      simnetPlan,
      contractName,
      manifestDir
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
 * Get the contract source code from the simnet plan.
 * @param simnetPlan The parsed simnet plan.
 * @param manifestDir The relative path to the manifest directory.
 * @param sutContractName The target contract name.
 * @returns The contract source code.
 */
export const getSimnetPlanContractSource = (
  simnetPlan: SimnetPlan,
  manifestDir: string,
  sutContractName: string
) => {
  // Filter for transactions that contain "emulated-contract-publish".
  const contractInfo = simnetPlan.plan.batches
    .flatMap((batch: Batch) => batch.transactions)
    .find(
      (transaction: Transaction) =>
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
 * @param simnetPlan The parsed simnet plan.
 * @param sutContractName The target contract name.
 * @param manifestDir The relative path to the manifest directory.
 * @returns The test contract source code.
 */
export const getTestContractSource = (
  simnetPlan: SimnetPlan,
  sutContractName: string,
  manifestDir: string
): string => {
  const contractInfo = simnetPlan.plan.batches
    .flatMap((batch: Batch) => batch.transactions)
    .find(
      (transaction: Transaction) =>
        transaction["emulated-contract-publish"] &&
        transaction["emulated-contract-publish"]["contract-name"] ===
          sutContractName
    )?.["emulated-contract-publish"];

  const sutContractPath = contractInfo!.path;
  const extension = ".clar";

  if (!sutContractPath.endsWith(extension)) {
    throw new Error(
      `Invalid contract extension for the "${sutContractName}" contract.`
    );
  }

  const testContractPath = sutContractPath.replace(
    extension,
    `.tests${extension}`
  );

  try {
    return readFileSync(join(manifestDir, testContractPath), {
      encoding: "utf-8",
    }).toString();
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
