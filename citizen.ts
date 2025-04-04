import { readFileSync } from "fs";
import { join } from "path";
import yaml from "yaml";
import { initSimnet, Simnet } from "@hirosystems/clarinet-sdk";
import { EpochString } from "@hirosystems/clarinet-sdk-wasm";
import {
  bufferCV,
  BufferCV,
  Cl,
  ClarityType,
  cvToJSON,
  cvToValue,
  hexToCV,
  OptionalCV,
  principalCV,
  uintCV,
} from "@stacks/transactions";
import {
  Batch,
  ContractDeploymentProperties,
  ContractsByEpoch,
  SimnetPlan,
  Transaction,
} from "./citizen.types";
import { RemoteDataSettings } from "./app.types";
import { hexToBytes } from "@stacks/common";

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

  const simnetAddresses = [...simnet.getAccounts().values()];

  const stxBalancesMap = new Map(
    Array.from(simnetAddresses, (address) => {
      const balanceHex = simnet.runSnippet(`(stx-get-balance '${address})`);
      return [address, cvToValue(hexToCV(balanceHex))];
    })
  );

  const sbtcBalancesMap = new Map(
    Array.from(simnetAddresses, (address) => {
      try {
        const { result: getBalanceResult } = simnet.callReadOnlyFn(
          "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
          "get-balance",
          [Cl.principal(address)],
          address
        );

        // If the previous read-only call works, the user is working with
        // sBTC. This means we can proceed with restoring sBTC balances.
        const sbtcBalance = cvToJSON(getBalanceResult).value.value;

        return [address, sbtcBalance];
      } catch (e) {
        return [address, 0];
      }
    })
  );

  await simnet.initEmptySession(remoteDataSettings);

  simnetAddresses.forEach((address) => {
    simnet.mintSTX(address, stxBalancesMap.get(address)!);
  });

  // Combine the target contract with its tests into a single contract. The
  // resulting contract will replace the target contract in the simnet.

  /** The contract names mapped to the concatenated source code. */
  const rendezvousSources = new Map(
    [sutContractName]
      .map((contractName) =>
        buildRendezvousData(simnetPlan, contractName, manifestDir)
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
 * Groups contracts by epoch from the simnet plan.
 * @param simnetPlan The simnet plan.
 * @returns A record of contracts grouped by epoch. The record key is the epoch
 * string, and the value is an array of contracts. Each contract is represented
 * as a record with the contract name as the key and a record containing the
 * contract path and clarity version as the value.
 */
export const groupContractsByEpochFromSimnetPlan = (
  simnetPlan: SimnetPlan
): ContractsByEpoch => {
  return simnetPlan.plan.batches.reduce(
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
    props: ContractDeploymentProperties
  ) => string
): Promise<void> => {
  for (const [epoch, contracts] of Object.entries(contractsByEpoch)) {
    // Move to the next epoch and deploy the contracts in the correct order.
    simnet.setEpoch(epoch as EpochString);
    for (const contract of contracts.flatMap(Object.entries)) {
      const [name, props]: [string, ContractDeploymentProperties] = contract;

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
 * Conditionally retrieves the contract source based on whether the contract is
 * a SUT contract or not.
 * @param targetContractNames The list of target contract names.
 * @param rendezvousSourcesMap The contract names mapped to the concatenated
 * source code.
 * @param contractName The contract name.
 * @param contractProps The contract deployment properties.
 * @param manifestDir The relative path to the manifest directory.
 * @returns The contract source code.
 */
export const getContractSource = (
  targetContractNames: string[],
  rendezvousSourcesMap: Map<string, string>,
  contractName: string,
  contractProps: ContractDeploymentProperties,
  manifestDir: string
): string => {
  if (targetContractNames.includes(contractName)) {
    const contractSource = rendezvousSourcesMap.get(contractName);
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
 * @param simnetPlan The parsed simnet plan.
 * @param contractName The contract name.
 * @param manifestDir The relative path to the manifest directory.
 * @returns The Rendezvous data representing a record. The returned record
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
  } catch (error: any) {
    throw new Error(
      `Error processing "${contractName}" contract: ${error.message}`
    );
  }
};

/**
 * Retrieves the contract source code using the simnet plan.
 * @param simnetPlan The parsed simnet plan.
 * @param manifestDir The relative path to the manifest directory.
 * @param sutContractName The target contract name.
 * @returns The contract source code.
 */
const getSimnetPlanContractSource = (
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
      `"${sutContractName}" contract not found in Clarinet.toml.`
    );
  }

  return readFileSync(join(manifestDir, contractInfo.path), {
    encoding: "utf-8",
  }).toString();
};

/**
 * Retrieves the test contract source code.
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
  } catch (error: any) {
    throw new Error(
      `Error retrieving the corresponding test contract for the "${sutContractName}" contract. ${error.message}`
    );
  }
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
  // To deposit sBTC, one needs a txId and a sweep txId. A deposit transaction
  // must have a unique txId and sweep txId. A set will be used to track the
  // already used ids. This set will be used in `getUniqueRandomHex`.
  const usedTxIds: Set<string> = new Set();

  // For each address present in the balances map, restore the balance.
  [...sbtcBalancesMap.entries()]
    // Re-assure the map does not contain nil balances.
    .filter(([_, balance]) => balance !== 0)
    .forEach(([address, balance]) => {
      const txId = getUniqueRandomHex(usedTxIds);
      const sweepTxId = getUniqueRandomHex(usedTxIds);
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
  const blockHeight = simnet.blockHeight;

  // Calling `get-burn-header` only works for past block heights. We mine one
  // empty Bitcoin block along with a Stacks one to make sure this happens.
  simnet.mineEmptyBurnBlocks(1);

  const burnHash = simnet.callReadOnlyFn(
    "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-deposit",
    "get-burn-header",
    [
      // (height uint)
      uintCV(blockHeight),
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
        bufferCV(hexToBytes(txId)),
        // (vout-index uint)
        uintCV(1),
        // (amount uint)
        uintCV(amountSats),
        // (recipient principal)
        principalCV(recipient),
        // (burn-hash (buff 32))
        burnHash.value,
        // (burn-height uint)
        uintCV(blockHeight),
        // (sweep-txid (buff 32))
        bufferCV(hexToBytes(sweepTxId)),
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
 * @param usedTxIds A set containing the already used hex strings.
 *
 * @returns A random hex string.
 */
const getUniqueRandomHex = (usedTxIds: Set<string>): string => {
  let hex: string;

  // Keep trying to generate random hex strings until the generated one is not
  // present in the `usedTxIds` set.
  do {
    // Generate a 32-byte (64 character) random hex string.
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    hex = Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } while (usedTxIds.has(hex));

  // Add to used set to ensure uniqueness.
  usedTxIds.add(hex);
  return hex;
};
