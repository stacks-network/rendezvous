import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { ClarityValue, cvToString } from "@stacks/transactions";

/**
 * Initializes the Clarity VM state database with the specified balances file.
 *
 * @param balancesFilePath
 * @param clarityCliDataPath
 * @returns The output of the `clarity-cli initialize` command.
 */
export const clarityCliInitialize = (
  balancesFilePath: string,
  clarityCliDataPath: string
) => {
  const cmd = `clarity-cli initialize --testnet ${balancesFilePath} ${clarityCliDataPath}`;
  try {
    const result = execSync(cmd, { stdio: "pipe" }).toString().trim();

    // Remove the balances file after initialization. It is no longer needed.
    fs.unlinkSync(balancesFilePath);
    return result;
  } catch (error: any) {
    return (
      error.stdout?.toString().trim() ||
      error.stderr?.toString().trim() ||
      error.message
    );
  }
};

/**
 * Launches a contract in the Clarity VM.
 *
 * @param contractIdentifier - The fully-qualified contract identifier.
 * @param contractPath - The path to the contract source file.
 * @param clarityCliDataPath - The path to the Clarity VM state database.
 * @returns The output of the clarity-cli launch command.
 */
export const clarityCliLaunch = (
  contractIdentifier: string,
  contractPath: string,
  clarityCliDataPath: string
): string => {
  const cmd = `clarity-cli launch ${contractIdentifier} ${contractPath} ${clarityCliDataPath}`;
  try {
    const result = execSync(cmd, { stdio: "pipe" }).toString().trim();

    // Remove the contract file after launch. It is no longer needed.
    fs.unlinkSync(contractPath);

    return result;
  } catch (error: any) {
    return (
      error.stdout?.toString().trim() ||
      error.stderr?.toString().trim() ||
      error.message
    );
  }
};

/**
 * Executes a function in a contract in the Clarity VM.
 *
 * @param clarityCliDataPath - The path to the Clarity VM state database.
 * @param contractIdentifier - The fully-qualified contract identifier.
 * @param functionName - The function to execute.
 * @param senderAddress - The address of the sender.
 * @param args - The stringified arguments to the function.
 * @returns The output of the clarity-cli execute command.
 */
export const clarityCliExecute = (
  clarityCliDataPath: string,
  contractIdentifier: string,
  functionName: string,
  senderAddress: string,
  args: string
): string => {
  const cmd = `clarity-cli execute ${clarityCliDataPath} ${contractIdentifier} ${functionName} ${senderAddress} ${args}`;
  try {
    return execSync(cmd, { stdio: "pipe" }).toString().trim();
  } catch (error: any) {
    return (
      error.stdout?.toString().trim() ||
      error.stderr?.toString().trim() ||
      error.message
    );
  }
};

/**
 * Generates a unique temporary file path for the Clarity VM state database.
 *
 * @returns The unique clarity-cli data path.
 */
export const generateClarityCliDataPath = () => {
  const clarityCliDataPath = generateSafeTempFilePath("-clarity-cli-vm", "db");
  return clarityCliDataPath;
};

/**
 * Utility function to store a balances file to a unique temporary file.
 *
 * @returns The path to the stored balances file.
 */
export const storeBalancesFile = () => {
  const balancesPath = generateSafeTempFilePath("-clarity-cli-ustx", "json");
  const balancesJson = JSON.stringify([
    {
      principal: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      amount: 100000000000000,
    },
  ]);
  fs.writeFileSync(balancesPath, balancesJson);
  return balancesPath;
};

/**
 * Utility function to store a contract to a unique temporary file.
 *
 * @param contractCode - The contract code to store.
 * @returns The path to the stored contract file.
 */
export const storeContract = (contractCode: string) => {
  const contractPath = generateSafeTempFilePath("-clarity-cli", "clar");
  fs.writeFileSync(contractPath, contractCode);
  return contractPath;
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

/**
 * Generates a unique temp file path based on the timestamp and process ID.
 *
 * @param prefix - Prefix to append to the generated filename.
 * @param extension - File extension of the temporary file.
 * @returns A unique file path.
 */
const generateSafeTempFilePath = (
  prefix: string,
  extension: string
): string => {
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  return path.join(
    __dirname,
    "tmp",
    `${timestamp}-${process.pid}${prefix}.${extension}`
  );
};

/**
 * Utility function to get the deployer address from the balances file.
 *
 * @param balancesFilePath - The path to the balances file.
 * @returns The deployer address.
 */
export const getDeployerFromBalancesFile = (balancesFilePath: string) => {
  return JSON.parse(fs.readFileSync(balancesFilePath, "utf8"))[0].principal;
};
