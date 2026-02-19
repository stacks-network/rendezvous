import { Simnet } from "@stacks/clarinet-sdk";
import { EpochString } from "@stacks/clarinet-sdk-wasm";

export type SimnetSession = {
  simnet: Simnet;
  resetSession: () => Promise<void>;
  cleanupSession: () => void;
};

export type EmulatedContractPublish = {
  "transaction-type": "emulated-contract-publish";
  "contract-name": string;
  "emulated-sender": string;
  path: string;
  "clarity-version": 1 | 2 | 3 | 4;
};

// Enough to support EmulatedContractPublish for now, but can be extended to
// support more transaction types in the future.
export type Transaction = EmulatedContractPublish;

export type Batch = {
  id: number;
  transactions: Transaction[];
  epoch: EpochString;
};

type Plan = {
  batches: Batch[];
};

type Wallet = {
  name: string;
  address: string;
  balance: string;
};

type Genesis = {
  wallets: Wallet[];
  contracts: string[];
};

export type DeploymentPlan = {
  id: number;
  name: string;
  network: string;
  genesis: Genesis;
  plan: Plan;
};
