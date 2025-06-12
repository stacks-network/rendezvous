import { EpochString } from "@hirosystems/clarinet-sdk-wasm";

type Wallet = {
  name: string;
  address: string;
  balance: string;
};

type Genesis = {
  wallets: Wallet[];
  contracts: string[];
};

export type EmulatedContractPublish = {
  "contract-name": string;
  "emulated-sender": string;
  path: string;
  "clarity-version": 1 | 2 | 3;
};

export type Transaction = {
  "emulated-contract-publish"?: EmulatedContractPublish;
};

export type Batch = {
  id: number;
  transactions: Transaction[];
  epoch: EpochString;
};

type Plan = {
  batches: Batch[];
};

export type SimnetPlan = {
  id: number;
  name: string;
  network: string;
  genesis: Genesis;
  plan: Plan;
};

export type ContractsByEpoch = Record<
  EpochString,
  Record<string, ContractDeploymentProperties>[]
>;

export type ContractDeploymentProperties = {
  path: string;
  clarity_version: 1 | 2 | 3;
};
