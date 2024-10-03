import { ClarityValue, cvToString } from "@stacks/transactions";

/**
 * Initializes the Clarity VM state database with the specified balances file.
 *
 * @param balancesFilePath - The path to the balances file.
 * @param clarityCliDataPath - The path to the Clarity VM state database.
 * @param handler - The function to handle the command execution.
 * @returns The output of the `clarity-cli initialize` command.
 */
export const clarityCliInitialize = (
  balancesFilePath: string,
  clarityCliDataPath: string,
  handler: (cmd: string) => string
) => {
  const cmd = `clarity-cli initialize --testnet ${balancesFilePath} ${clarityCliDataPath}`;
  return handler(cmd);
};

/**
 * Launches a contract in the Clarity VM.
 *
 * @param contractIdentifier - The fully-qualified contract identifier.
 * @param contractPath - The path to the contract source file.
 * @param clarityCliDataPath - The path to the Clarity VM state database.
 * @param handler - The function to handle the command execution.
 * @returns The output of the clarity-cli launch command.
 */
export const clarityCliLaunch = (
  contractIdentifier: string,
  contractPath: string,
  clarityCliDataPath: string,
  handler: (cmd: string) => string
): string => {
  const cmd = `clarity-cli launch ${contractIdentifier} ${contractPath} ${clarityCliDataPath}`;
  return handler(cmd);
};

/**
 * Executes a function in a contract in the Clarity VM.
 *
 * @param clarityCliDataPath - The path to the Clarity VM state database.
 * @param contractIdentifier - The fully-qualified contract identifier.
 * @param functionName - The function to execute.
 * @param senderAddress - The address of the sender.
 * @param args - The stringified arguments to the function.
 * @param handler - The function to handle the command execution.
 * @returns The output of the clarity-cli execute command.
 */
export const clarityCliExecute = (
  clarityCliDataPath: string,
  contractIdentifier: string,
  functionName: string,
  senderAddress: string,
  args: string,
  handler: (cmd: string) => string
): string => {
  const cmd = `clarity-cli execute ${clarityCliDataPath} ${contractIdentifier} ${functionName} ${senderAddress} ${args}`;
  return handler(cmd);
};

/**
 * Utility function to stringify Clarity arguments for `clarity-cli execute`.
 *
 * @param clarityArguments - The Clarity arguments.
 * @returns A stringified representation of the Clarity arguments
 * which can be passed to clarity-cli execute.
 */
export const stringifyClarityArguments = (clarityArguments: ClarityValue[]) =>
  clarityArguments.reduce(
    (acc, arg) =>
      acc === ""
        ? `"${cvToString(arg).replace(/(["\\$`])/g, "\\$1")}"`
        : `${acc} "${cvToString(arg).replace(/(["\\$`])/g, "\\$1")}"`,
    ""
  );
