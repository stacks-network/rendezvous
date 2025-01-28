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
  functionArgsArb: any;
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
