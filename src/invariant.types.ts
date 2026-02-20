/**
 * LocalContext is a data structure used to track the number of times each SUT
 * function is called for every contract. It is a nested map where:
 * - The outer key is the contract identifier.
 * - The inner key is the SUT function name within the contract.
 * - The value is the count of times the SUT function has been invoked.
 */
export type LocalContext = {
  [contractId: string]: {
    [functionName: string]: number;
  };
};
