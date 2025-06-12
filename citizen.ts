import { readFileSync } from "fs";
import { join } from "path";
import yaml from "yaml";
import { initSimnet, Simnet } from "@hirosystems/clarinet-sdk";
import { EpochString } from "@hirosystems/clarinet-sdk-wasm";
import {
  BufferCV,
  Cl,
  ClarityType,
  cvToJSON,
  cvToValue,
  hexToCV,
  OptionalCV,
} from "@stacks/transactions";
import {
  Batch,
  ContractDeploymentProperties,
  ContractsByEpoch,
  EmulatedContractPublish,
  DeploymentPlan,
  Transaction,
} from "./citizen.types";
import { RemoteDataSettings } from "./app.types";

/**
 * Prepares the simnet instance and assures the target contract's corresponding
 * test contract is treated as a first-class citizen, relying on their
 * concatenation. This function handles:
 * - Contract sorting by epoch based on the deployment plan.
 * - Combining the target contract with its tests and deploying all contracts
 *   to the simnet.
 *
 * @param manifestDir The relative path to the manifest directory.
 * @param manifestPath The absolute path to the manifest file.
 * @param remoteDataSettings The remote data settings.
 * @param sutContractName The target contract name.
 * @returns The initialized simnet instance with all contracts deployed, with
 * the test contract treated as a first-class citizen of the target contract.
 */
export const issueFirstClassCitizenship = async (
  manifestDir: string,
  manifestPath: string,
  remoteDataSettings: RemoteDataSettings,
  sutContractName: string
): Promise<Simnet> => {
  // Initialize the simnet, to generate the deployment plan and instance. The
  // empty session will be set up, and contracts will be deployed in the
  // correct order based on the deployment plan a few lines below.
  const simnet = await initSimnet(manifestPath);

  const deploymentPlan = yaml.parse(
    readFileSync(join(manifestDir, "deployments", "default.simnet-plan.yaml"), {
      encoding: "utf-8",
    })
  );

  const sortedContractsByEpoch =
    groupContractsByEpochFromDeploymentPlan(deploymentPlan);

  const simnetAddresses = [...simnet.getAccounts().values()];

  const stxBalancesMap = new Map(
    simnetAddresses.map((address) => {
      const balanceHex = simnet.runSnippet(`(stx-get-balance '${address})`);
      return [address, cvToValue(hexToCV(balanceHex))];
    })
  );

  const sbtcBalancesMap = getSbtcBalancesFromSimnet(simnet);

  await simnet.initEmptySession(remoteDataSettings);

  simnetAddresses.forEach((address) => {
    simnet.mintSTX(address, stxBalancesMap.get(address)!);
  });

  // Combine the target contract with its tests into a single contract. The
  // resulting contract will replace the target contract in the simnet.

  /** The contract names mapped to the concatenated source code. */
  const rendezvousSources = new Map(
    [sutContractName]
      // For each target contract name, execute the processing steps to get the
      // concatenated contract source code and the contract ID.
      .map((contractName) =>
        buildRendezvousData(deploymentPlan, contractName, manifestDir)
      )
      // Use the contract ID as a key, mapping to the concatenated contract
      // source code.
      .map((rendezvousContractData) => [
        rendezvousContractData.rendezvousContractId,
        rendezvousContractData.rendezvousSourceCode,
      ])
  );

  // Deploy the contracts to the empty simnet session in the correct order.
  await deployContracts(simnet, sortedContractsByEpoch, (name, sender, props) =>
    getContractSource(
      [sutContractName],
      rendezvousSources,
      name,
      sender,
      props,
      manifestDir
    )
  );

  // Filter out addresses with zero balance. They do not need to be restored.
  const sbtcBalancesToRestore: Map<string, number> = new Map(
    [...sbtcBalancesMap.entries()].filter(([_, balance]) => balance !== 0)
  );

  // After all the contracts and requirements are deployed, if the test wallets
  // had sBTC balances previously, restore them. If no test wallet previously
  // owned sBTC, skip this step.
  if ([...sbtcBalancesToRestore.keys()].length > 0) {
    restoreSbtcBalances(simnet, sbtcBalancesToRestore);
  }

  return simnet;
};

/**
 * Groups contracts by epoch from the deployment plan.
 * @param deploymentPlan The parsed deployment plan.
 * @returns A record of contracts grouped by epoch. The record key is the epoch
 * string, and the value is an array of contracts. Each contract is represented
 * as a record with the contract name as the key and a record containing the
 * contract path and clarity version as the value.
 */
export const groupContractsByEpochFromDeploymentPlan = (
  deploymentPlan: DeploymentPlan
): ContractsByEpoch => {
  return deploymentPlan.plan.batches.reduce(
    (acc: ContractsByEpoch, batch: Batch) => {
      const epoch = batch.epoch;
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
        acc[epoch] = (acc[epoch] || []).concat(contracts);
      }

      return acc;
    },
    {} as ContractsByEpoch
  );
};

/**
 * Deploys the contracts to the simnet in the correct order.
 * @param simnet The simnet instance.
 * @param contractsByEpoch The record of contracts by epoch.
 * @param getContractSourceFn The function to retrieve the contract source.
 */
const deployContracts = async (
  simnet: Simnet,
  contractsByEpoch: ContractsByEpoch,
  getContractSourceFn: (
    name: string,
    sender: string,
    props: ContractDeploymentProperties
  ) => string
): Promise<void> => {
  for (const [epoch, contracts] of Object.entries(contractsByEpoch)) {
    // Move to the next epoch and deploy the contracts in the correct order.
    simnet.setEpoch(epoch as EpochString);
    for (const contract of contracts.flatMap(Object.entries)) {
      const [name, props]: [string, ContractDeploymentProperties] = contract;

      // For requirement contracts, use the original sender. The sender address
      // is included in the path:
      // "./.cache/requirements/<address>.contract-name.clar".
      const sender = props.path.includes(".cache")
        ? props.path.split("requirements")[1].slice(1).split(".")[0]
        : simnet.deployer;

      const source = getContractSourceFn(name, sender, props);

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
 * Conditionally retrieves the contract source based on whether the contract is
 * a SUT contract or not.
 * @param targetContractNames The list of target contract names.
 * @param rendezvousSourcesMap The target contract IDs mapped to the resulting
 * concatenated source code.
 * @param contractName The contract name.
 * @param contractSender The emulated sender of the contract according to the
 * deployment plan.
 * @param contractProps The contract deployment properties.
 * @param manifestDir The relative path to the manifest directory.
 * @returns The contract source code.
 */
export const getContractSource = (
  targetContractNames: string[],
  rendezvousSourcesMap: Map<string, string>,
  contractName: string,
  contractSender: string,
  contractProps: ContractDeploymentProperties,
  manifestDir: string
): string => {
  const contractId = `${contractSender}.${contractName}`;

  // Checking if a contract is a SUT one just by using the name is not enough.
  // There can be multiple contracts with the same name, but different senders
  // in the deployment plan. The contract ID is the unique identifier used to
  // store the concatenated Rendezvous source codes in the
  // `rendezvousSourcesMap`.
  if (
    targetContractNames.includes(contractName) &&
    rendezvousSourcesMap.has(contractId)
  ) {
    const contractSource = rendezvousSourcesMap.get(contractId);
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
 * Builds the Rendezvous data.
 * @param deploymentPlan The parsed deployment plan.
 * @param contractName The contract name.
 * @param manifestDir The relative path to the manifest directory.
 * @returns The Rendezvous data representing a record. The returned record
 * contains the Rendezvous source code and the unique Rendezvous contract ID.
 */
export const buildRendezvousData = (
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
 * Retrieves the test contract source code.
 * @param deploymentPlan The parsed deployment plan.
 * @param sutContractName The target contract name.
 * @param manifestDir The relative path to the manifest directory.
 * @returns The test contract source code.
 */
export const getTestContractSource = (
  deploymentPlan: DeploymentPlan,
  sutContractName: string,
  manifestDir: string
): string => {
  const sutContractPath = getSutContractDeploymentPlanEmulatedPublish(
    deploymentPlan,
    sutContractName
  ).path;
  const clarityExtension = ".clar";

  if (!sutContractPath.endsWith(clarityExtension)) {
    throw new Error(
      `Invalid contract extension for the "${sutContractName}" contract.`
    );
  }

  // If the sutContractPath is located under .cache/requirements/ path, search
  // for the test contract in the classic `contracts` directory.
  if (sutContractPath.includes(".cache")) {
    const relativePath = sutContractPath.split(".cache/requirements/")[1];
    const relativePathTestContract = relativePath.replace(
      clarityExtension,
      `.tests${clarityExtension}`
    );

    return readFileSync(
      join(manifestDir, "contracts", relativePathTestContract),
      {
        encoding: "utf-8",
      }
    ).toString();
  }

  // If the contract is not under the `.cache/requirements/` path, we assume it
  // is located in a regular path specified in the manifest file. Just search
  // for the test contract near the SUT one, following the naming
  // convention: `<contract-name>.tests.clar`.
  const testContractPath = sutContractPath.replace(
    clarityExtension,
    `.tests${clarityExtension}`
  );

  try {
    return readFileSync(join(manifestDir, testContractPath), {
      encoding: "utf-8",
    }).toString();
  } catch (error: any) {
    throw new Error(
      `Error retrieving the corresponding test contract for the "${sutContractName}" contract. ${error.message}`
    );
  }
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

/**
 * Maps the simnet accounts to their sBTC balances. The function tries to call
 * the `get-balance` function of the `sbtc-token` contract for each address. If
 * the call fails, it returns a balance of 0 for that address. The call fails
 * if the user is not working with sBTC.
 * @param simnet The simnet instance.
 * @returns A map of addresses to their sBTC balances.
 */
export const getSbtcBalancesFromSimnet = (
  simnet: Simnet
): Map<string, number> =>
  new Map(
    [...simnet.getAccounts().values()].map((address) => {
      try {
        const { result: getBalanceResult } = simnet.callReadOnlyFn(
          "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
          "get-balance",
          [Cl.principal(address)],
          address
        );

        // If the previous read-only call works, the user is working with
        // sBTC. This means we can proceed with restoring sBTC balances.
        const sbtcBalanceJSON = cvToJSON(getBalanceResult);

        // The `get-balance` function returns a response containing the uint
        // balance of the address. In the JSON representation, the balance is
        // represented as a string. We need to parse it to an integer.
        const sbtcBalance = parseInt(sbtcBalanceJSON.value.value, 10);

        return [address, sbtcBalance];
      } catch (e) {
        return [address, 0];
      }
    })
  );

/**
 * Utility function that restores the test wallets' initial sBTC balances in
 * the re-initialized first-class citizenship simnet.
 *
 * @param simnet The simnet instance.
 * @param sbtcBalancesMap A map containing the test wallets' balances to be
 * restored.
 */
const restoreSbtcBalances = (
  simnet: Simnet,
  sbtcBalancesMap: Map<string, number>
) => {
  // For each address present in the balances map, restore the balance.
  [...sbtcBalancesMap.entries()]
    // Re-assure the map does not contain nil balances.
    .filter(([_, balance]) => balance !== 0)
    .forEach(([address, balance]) => {
      // To deposit sBTC, one needs a txId and a sweep txId. A deposit transaction
      // must have a unique txId and sweep txId.
      const txId = getUniqueHex();
      const sweepTxId = getUniqueHex();
      mintSbtc(simnet, balance, address, txId, sweepTxId);
    });
};

/**
 * Utility function to deposit an amount of sBTC to a Stacks address.
 *
 * @param simnet The simnet instance.
 * @param amountSats The amount to mint in sats.
 * @param recipient The Stacks address to mint sBTC to.
 * @param txId A unique hex to use for the deposit.
 * @param sweepTxId A unique hex to use for the deposit.
 */
const mintSbtc = (
  simnet: Simnet,
  amountSats: number,
  recipient: string,
  txId: string,
  sweepTxId: string
) => {
  // Calling `get-burn-header` only works for past block heights. We mine one
  // empty Stacks block if the initial height is 0.
  if (simnet.blockHeight === 0) {
    simnet.mineEmptyBlock();
  }

  const previousStacksHeight = simnet.blockHeight - 1;

  const burnHash = simnet.callReadOnlyFn(
    "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-deposit",
    "get-burn-header",
    [
      // (height uint)
      Cl.uint(previousStacksHeight),
    ],
    simnet.deployer
  ).result as OptionalCV<BufferCV>;

  if (burnHash === null || burnHash.type === ClarityType.OptionalNone) {
    throw new Error("Something went wrong trying to retrieve the burn header.");
  }

  const completeDepositTx = cvToJSON(
    simnet.callPublicFn(
      "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-deposit",
      "complete-deposit-wrapper",
      [
        // (txid (buff 32))
        Cl.bufferFromHex(txId),
        // (vout-index uint)
        Cl.uint(1),
        // (amount uint)
        Cl.uint(amountSats),
        // (recipient principal)
        Cl.principal(recipient),
        // (burn-hash (buff 32))
        burnHash.value,
        // (burn-height uint)
        Cl.uint(previousStacksHeight),
        // (sweep-txid (buff 32))
        Cl.bufferFromHex(sweepTxId),
      ],
      "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4"
    ).result
  );

  // If the deposit transaction fails, an unexpected outcome can happen. Throw
  // an error if the transaction is not successful.
  if (!completeDepositTx.success) {
    throw new Error("Something went wrong trying to restore sBTC balances.");
  }
};

/**
 * Utility function that generates a random, unique hex to be used as txId in
 * `mintSbtc`.
 *
 * @returns A random hex string.
 */
const getUniqueHex = (): string => {
  let hex: string;

  // Generate a 32-byte (64 character) random hex string.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  hex = Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return hex;
};
