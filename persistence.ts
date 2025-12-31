import { promises } from "fs";
import * as path from "path";
import { RunDetails } from "./heatstroke.types";

/**
 * Represents a persisted failure record for regression testing.
 */
interface FailureRecord {
  /** The seed used by fast-check for this test run */
  seed: number;
  /** The path for reproducing the exact failure (if available) */
  path?: string;
  /** Timestamp when the failure was recorded */
  timestamp: number;
}

/**
 * Container for all failures grouped by test type.
 */
interface FailureStore {
  /** Failures from invariant tests */
  invariant: FailureRecord[];
  /** Failures from property tests */
  test: FailureRecord[];
}

/**
 * Configuration for persistence behavior.
 */
interface PersistenceConfig {
  /** Base directory for storing regression files. Default: 'rendezvous-regressions' */
  baseDir?: string;
  /** Maximum number of failures to keep per contract. Default: 100 */
  maxFailures?: number;
}

/** Default configuration for persistence behavior. */
const DEFAULT_CONFIG: Required<PersistenceConfig> = {
  baseDir: "rendezvous-regressions",
  maxFailures: 100,
};

/**
 * Gets the file path for a contract's failure store.
 * Uses contractId as filename (e.g., "ST1...ADDR.counter.json")
 */
const getFailureFilePath = (contractId: string, baseDir: string): string => {
  return path.join(baseDir, `${contractId}.json`);
};

/**
 * Loads the failure store for a contract, or creates an empty one.
 */
const loadFailureStore = async (
  contractId: string,
  baseDir: string
): Promise<FailureStore> => {
  const filePath = getFailureFilePath(contractId, baseDir);

  try {
    const content = await promises.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      // File doesn't exist - return empty store.
      return { invariant: [], test: [] };
    }
    console.warn(
      `Warning: Could not read ${filePath}, starting fresh:`,
      error.message
    );
    return { invariant: [], test: [] };
  }
};

/**
 * Saves the failure store for a contract.
 */
const saveFailureStore = async (
  contractId: string,
  baseDir: string,
  store: FailureStore
): Promise<void> => {
  // Ensure the base directory exists
  await promises.mkdir(baseDir, { recursive: true });

  const filePath = getFailureFilePath(contractId, baseDir);
  await promises.writeFile(filePath, JSON.stringify(store, null, 2), "utf-8");
};

/**
 * Persists a test failure for future regression testing.
 *
 * @param runDetails The test run details from fast-check
 * @param type The type of test that failed
 * @param contractId The contract identifier being tested
 * @param config Optional configuration for persistence behavior
 */
export const persistFailure = async (
  runDetails: RunDetails,
  type: "invariant" | "test",
  contractId: string,
  config?: PersistenceConfig
): Promise<void> => {
  const { baseDir, maxFailures } = { ...DEFAULT_CONFIG, ...config };

  // Load existing store.
  const store = await loadFailureStore(contractId, baseDir);

  const record: FailureRecord = {
    seed: runDetails.seed,
    path: runDetails.path,
    timestamp: Date.now(),
  };

  // Get the array for this test type.
  const failures = store[type];

  // Check if this seed already exists.
  const seedExists = failures.some((f) => f.seed === record.seed);
  if (seedExists) {
    // Already recorded.
    return;
  }

  // Add new failure.
  failures.push(record);

  // Keep only the most recent failures, bounded by maxFailures.
  if (failures.length > maxFailures) {
    // Sort the failures by timestamp in descending order.
    failures.sort((a, b) => b.timestamp - a.timestamp);
    // Keep only the most recent failures, bounded by maxFailures.
    failures.splice(maxFailures);
  }

  // Save back to file.
  await saveFailureStore(contractId, baseDir, store);
};

// TODO: Useful for loading failures in the beginning of the test run.
/**
 * Loads persisted failures for a given contract and test type.
 *
 * @param contractId The contract identifier
 * @param type The type of test ("invariant" or "test")
 * @param config Optional configuration
 * @returns Array of failure records, or empty array if none exist
 */
const loadFailures = async (
  contractId: string,
  type: "invariant" | "test",
  config?: PersistenceConfig
): Promise<FailureRecord[]> => {
  const { baseDir } = { ...DEFAULT_CONFIG, ...config };
  const store = await loadFailureStore(contractId, baseDir);

  // O(1) lookup by type
  return store[type];
};
