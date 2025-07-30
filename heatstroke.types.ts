import { ContractInterfaceFunction } from "@hirosystems/clarinet-sdk-wasm";

export type RunDetails = {
  failed: boolean;
  counterexample: CounterExample[];
  numRuns: number;
  seed: number;
  path?: string;
  error: Error;
};

type CounterExample = TestCounterExample | InvariantCounterExample;

export type TestCounterExample = {
  testContractId: string;
  selectedTestFunction: ContractInterfaceFunction;
  functionArgs: any;
  testCaller: [string, string];
};

export type InvariantCounterExample = {
  rendezvousContractId: string;
  selectedFunctions: ContractInterfaceFunction[];
  selectedFunctionsArgsList: any[];
  sutCallers: [string, string][];
  selectedInvariant: ContractInterfaceFunction;
  invariantArgs: any;
  invariantCaller: [string, string];
};

type SutFunctionStatistics = {
  successful: Map<string, number>;
  failed: Map<string, number>;
};

type InvariantFunctionStatistics = {
  successful: Map<string, number>;
  failed: Map<string, number>;
};

type TestFunctionStatistics = {
  successful: Map<string, number>;
  discarded: Map<string, number>;
  failed: Map<string, number>;
};

export type Statistics = {
  sut?: SutFunctionStatistics;
  invariant?: InvariantFunctionStatistics;
  test?: TestFunctionStatistics;
};

/**
 * Options for configuring tree statistics reporting.
 */
export interface StatisticsTreeOptions {
  isLastSection?: boolean;
  baseIndent?: string;
}
