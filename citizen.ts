import { readFileSync } from "fs";
import { join } from "path";
import yaml from "yaml";
import { ClarinetToml, ClarinetTomlContractProps } from "./citizen.types";
import toml from "@iarna/toml";
import { buildRendezvousData } from "./shared";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { EpochString } from "@hirosystems/clarinet-sdk-wasm";

/**
 * Prepares the simnet environment and assures the target contract is treated
 * as a first-class citizen. This function handles:
 * - Parsing and preprocessing the manifest file to extract contract
 *   configurations.
 * - Grouping contracts by their associated deployment epochs.
 * - Sorting contracts by epoch and reordering contracts within each epoch
 *   based on the deployment plan.
 * - Combining the target contract with its tests and deploying all contracts
 *   to the simnet.
 *
 * @param manifestDir - The relative path to the manifest directory.
 * @param sutContractName - The target contract name.
 * @returns The initialized simnet instance with all contracts deployed, with
 * the target contract treated as a first-class citizen.
 */
export const firstClassCitizenship = async (
  manifestDir: string,
  sutContractName: string
) => {
  const manifestPath = join(manifestDir, "Clarinet.toml");
  const clarinetToml = parseAndPreprocessManifest(manifestPath);
  const contractsByEpoch = groupContractsByEpoch(clarinetToml.contracts);
  const sortedContractsByEpoch = sortContractsByEpoch(contractsByEpoch);
  const simnet = await initSimnet(manifestPath);

  const simnetPlan = yaml.parse(
    readFileSync(join(manifestDir, "deployments", "default.simnet-plan.yaml"), {
      encoding: "utf-8",
    })
  );

  const deploymentOrder = getDeploymentOrder(simnetPlan);
  const sortedContractsByEpochAndPlan = reorderContractsWithinEpoch(
    sortedContractsByEpoch,
    deploymentOrder
  );

  await simnet.initEmtpySession();

  const sutContractNames = [sutContractName];

  // Combine the contract with its tests. The combined contract will overwrite
  // the target contract in the simnet.
  const rendezvousData = sutContractNames.map((contractId) =>
    buildRendezvousData(clarinetToml, contractId, manifestDir)
  );

  const rendezvousMap = new Map(
    rendezvousData.map((rendezvousContractData) => [
      rendezvousContractData.rendezvousContractName,
      rendezvousContractData.rendezvousSource,
    ])
  );

  await deployContracts(simnet, sortedContractsByEpochAndPlan, (name, props) =>
    getContractSource(sutContractNames, rendezvousMap, name, props, manifestDir)
  );

  return simnet;
};

/**
 * Parses the manifest file and stringifies the epoch values to ensure they are
 * consistent with the possible epoch values.
 * @param manifestPath - The relative path to the manifest file.
 * @returns The parsed and preprocessed manifest file.
 */
const parseAndPreprocessManifest = (manifestPath: string): ClarinetToml => {
  const clarinetToml = toml.parse(
    readFileSync(manifestPath, { encoding: "utf-8" })
  ) as ClarinetToml;

  Object.entries(clarinetToml.contracts || {}).forEach(([_, props]) => {
    if (props.epoch !== undefined && typeof props.epoch === "number") {
      props.epoch =
        props.epoch === 2.05 ? props.epoch.toFixed(2) : props.epoch.toFixed(1);
    }
  });

  return clarinetToml;
};

/**
 * Groups contracts by their associated deployment epochs. Contracts without an
 * epoch are grouped under the default epoch "2.0". Contracts without a clarity
 * version are assigned the default clarity version 1.
 * @param contracts - The record of contracts from the manifest file.
 * @returns A record of contracts grouped by epoch.
 */
const groupContractsByEpoch = (
  contracts: Record<string, ClarinetTomlContractProps>
): Record<
  string,
  Record<string, { path: string; clarity_version: 1 | 2 | 3 }>[]
> => {
  return Object.entries(contracts).reduce(
    (
      acc: Record<
        string,
        Record<string, { path: string; clarity_version: 1 | 2 | 3 }>[]
      >,
      [name, props]
    ) => {
      const groupKey = props.epoch ?? "2.0";
      const clarityVersion = (props.clarity_version ?? 1) as 1 | 2 | 3;

      return {
        ...acc,
        [groupKey]: [
          ...(acc[groupKey] || []),
          { [name]: { path: props.path, clarity_version: clarityVersion } },
        ],
      };
    },
    {}
  );
};

/**
 * Sort the record of contracts by epoch in ascending order.
 * @param groupedContracts - The record of contracts grouped by epoch.
 * @returns The sorted record of contracts by epoch.
 */
const sortContractsByEpoch = (
  groupedContracts: Record<string, any>
): Record<string, any> => {
  return Object.fromEntries(
    Object.entries(groupedContracts).sort(
      ([epochA], [epochB]) => parseFloat(epochA) - parseFloat(epochB)
    )
  );
};

/**
 * Reorder the contracts within each epoch based on the deployment plan.
 * @param sortedContracts - The record of contracts sorted by epoch.
 * @param deploymentOrder - The deployment order map.
 * @returns The record of contracts with the contracts reordered within each
 * epoch based on the deployment plan.
 */
const reorderContractsWithinEpoch = (
  sortedContracts: Record<string, any>,
  deploymentOrder: Map<string, number>
): Record<string, any> => {
  return Object.fromEntries(
    Object.entries(sortedContracts).map(([epoch, contracts]) => [
      epoch,
      contracts
        .flatMap(Object.entries)
        .sort(
          ([nameA]: [string], [nameB]: [string]) =>
            (deploymentOrder.get(nameA) ?? Number.MAX_SAFE_INTEGER) -
            (deploymentOrder.get(nameB) ?? Number.MAX_SAFE_INTEGER)
        )
        .map(([name, data]: [string, any]) => ({ [name]: data })),
    ])
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
      const [name, props] = contract;
      const source = getContractSourceFn(name, props);
      simnet.deployContract(
        name,
        source,
        { clarityVersion: props.clarity_version },
        simnet.deployer
      );
    }
  }
};

/**
 * Retrieve the deployment order based on the deployment plan.
 * @param simnetPlan - The simnet plan.
 * @returns The deployment order map.
 */
const getDeploymentOrder = (simnetPlan: any): Map<string, number> => {
  return simnetPlan.plan.batches.reduce(
    (acc: any, batch: any) =>
      batch.transactions.reduce((innerAcc: any, tx: any) => {
        const contractName = tx["emulated-contract-publish"]?.["contract-name"];
        if (contractName && !innerAcc.has(contractName)) {
          innerAcc.set(contractName, innerAcc.size);
        }
        return innerAcc;
      }, acc),
    new Map<string, number>()
  );
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
