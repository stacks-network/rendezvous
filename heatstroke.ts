import { EventEmitter } from "events";
import { ContractInterfaceFunction } from "@hirosystems/clarinet-sdk-wasm";
import { green } from "ansicolor";
import {
  InvariantCounterExample,
  RunDetails,
  Statistics,
  StatisticsTreeOptions,
  TestCounterExample,
} from "./heatstroke.types";
import { getContractNameFromContractId } from "./shared";

/**
 * Heatstrokes Reporter
 *
 * Provides a detailed report when a test run test ends. In case of failure,
 * includes the contract, functions, arguments, outputs, and the specific
 * invariant or property test that failed.
 * @param runDetails The details of the test run provided by fast-check.
 * @property `runDetails.failed`: Indicates if the test run failed.
 * @property `runDetails.counterexample`: The input that caused the failure.
 * @property `runDetails.numRuns`: The number of test cases that were run.
 * @property `runDetails.seed`: The replay seed for reproducing the failure.
 * @property `runDetails.path`: The replay path for reproducing the failure.
 * @property `runDetails.error`: The error thrown during the test.
 * @param radio The event emitter to log messages.
 * @param type The type of test that failed: invariant or property.
 * @returns void
 */
export function reporter(
  runDetails: RunDetails,
  radio: EventEmitter,
  type: "invariant" | "test",
  statistics: Statistics
) {
  if (runDetails.failed) {
    // Report general run data.
    radio.emit(
      "logFailure",
      `\nError: Property failed after ${runDetails.numRuns} tests.`
    );
    radio.emit("logFailure", `Seed : ${runDetails.seed}`);
    if (runDetails.path) {
      radio.emit("logFailure", `Path : ${runDetails.path}`);
    }
    switch (type) {
      case "invariant": {
        const r = runDetails.counterexample[0] as InvariantCounterExample;
        // Report specific run data for the invariant testing type.
        radio.emit("logFailure", `\nCounterexample:`);
        radio.emit(
          "logFailure",
          `- Contract : ${getContractNameFromContractId(
            r.rendezvousContractId
          )}`
        );
        radio.emit(
          "logFailure",
          `- Functions: ${r.selectedFunctions
            .map(
              (selectedFunction: ContractInterfaceFunction) =>
                selectedFunction.name
            )
            .join(", ")} (${r.selectedFunctions
            .map(
              (selectedFunction: ContractInterfaceFunction) =>
                selectedFunction.access
            )
            .join(", ")})`
        );
        radio.emit(
          "logFailure",
          `- Arguments: ${r.selectedFunctionsArgsList
            .map((selectedFunctionArgs: any[]) =>
              JSON.stringify(selectedFunctionArgs)
            )
            .join(", ")}`
        );
        radio.emit(
          "logFailure",
          `- Callers  : ${r.sutCallers
            .map((sutCaller: [string, string]) => sutCaller[0])
            .join(", ")}`
        );
        radio.emit(
          "logFailure",
          `- Outputs  : ${r.selectedFunctions
            .map((selectedFunction: ContractInterfaceFunction) =>
              JSON.stringify(selectedFunction.outputs)
            )
            .join(", ")}`
        );
        radio.emit(
          "logFailure",
          `- Invariant: ${r.selectedInvariant.name} (${r.selectedInvariant.access})`
        );
        radio.emit(
          "logFailure",
          `- Arguments: ${JSON.stringify(r.invariantArgs)}`
        );
        radio.emit("logFailure", `- Caller   : ${r.invariantCaller[0]}`);

        radio.emit(
          "logFailure",
          `\nWhat happened? Rendezvous went on a rampage and found a weak spot:\n`
        );

        const formattedError = `The invariant "${
          r.selectedInvariant.name
        }" returned:\n\n${runDetails.error
          ?.toString()
          .split("\n")
          .map((line) => "    " + line)
          .join("\n")}\n`;

        radio.emit("logFailure", formattedError);

        break;
      }
      case "test": {
        const r = runDetails.counterexample[0] as TestCounterExample;

        // Report specific run data for the property testing type.
        radio.emit("logFailure", `\nCounterexample:`);
        radio.emit(
          "logFailure",
          `- Test Contract : ${getContractNameFromContractId(r.testContractId)}`
        );
        radio.emit(
          "logFailure",
          `- Test Function : ${r.selectedTestFunction.name} (${r.selectedTestFunction.access})`
        );
        radio.emit(
          "logFailure",
          `- Arguments     : ${JSON.stringify(r.functionArgs)}`
        );
        radio.emit("logFailure", `- Caller        : ${r.testCaller[0]}`);
        radio.emit(
          "logFailure",
          `- Outputs       : ${JSON.stringify(r.selectedTestFunction.outputs)}`
        );

        radio.emit(
          "logFailure",
          `\nWhat happened? Rendezvous went on a rampage and found a weak spot:\n`
        );

        const formattedError = `The test function "${
          r.selectedTestFunction.name
        }" returned:\n\n${runDetails.error
          ?.toString()
          .split("\n")
          .map((line) => "    " + line)
          .join("\n")}\n`;

        radio.emit("logFailure", formattedError);
        break;
      }
    }

    // Set non-zero exit code to properly signal test failure to shells,
    // scripts, CI systems, and other tools that check process exit status.
    process.exitCode = 1;
  } else {
    radio.emit(
      "logMessage",
      green(
        `\nOK, ${
          type === "invariant" ? "invariants" : "properties"
        } passed after ${runDetails.numRuns} runs.\n`
      )
    );
  }
  reportStatistics(statistics, type, radio);
  radio.emit("logMessage", "\n");
}

const ARROW = "->";
const SUCCESS_SYMBOL = "+";
const FAIL_SYMBOL = "-";
const WARN_SYMBOL = "!";

/**
 * Reports execution statistics in a tree-like format.
 * @param statistics The statistics object containing test execution data.
 * @param type The type of test being reported.
 * @param radio The event emitter for logging messages.
 */
function reportStatistics(
  statistics: Statistics,
  type: "invariant" | "test",
  radio: EventEmitter
): void {
  radio.emit("logMessage", `\nEXECUTION STATISTICS\n`);

  switch (type) {
    case "invariant": {
      if (!statistics.invariant || !statistics.sut) {
        radio.emit("logMessage", "└─ No statistics available for this run");
        return;
      }

      radio.emit("logMessage", "│ PUBLIC FUNCTION CALLS");
      radio.emit("logMessage", "│");
      radio.emit("logMessage", `├─ ${SUCCESS_SYMBOL} SUCCESSFUL`);
      logAsTree(Object.fromEntries(statistics.sut.successful), radio);

      radio.emit("logMessage", "│");
      radio.emit("logMessage", `├─ ${FAIL_SYMBOL} IGNORED`);
      logAsTree(Object.fromEntries(statistics.sut.failed), radio);

      radio.emit("logMessage", "│");
      radio.emit("logMessage", "│ INVARIANT CHECKS");
      radio.emit("logMessage", "│");
      radio.emit("logMessage", `├─ ${SUCCESS_SYMBOL} PASSED`);
      logAsTree(Object.fromEntries(statistics.invariant.successful), radio);

      radio.emit("logMessage", "│");
      radio.emit("logMessage", `└─ ${FAIL_SYMBOL} FAILED`);
      logAsTree(Object.fromEntries(statistics.invariant.failed), radio, {
        isLastSection: true,
      });
      break;
    }

    case "test": {
      if (!statistics.test) {
        radio.emit(
          "logMessage",
          "└─ No telemetry data available for this operation"
        );
        return;
      }

      radio.emit("logMessage", "│ PROPERTY TEST CALLS");
      radio.emit("logMessage", "│");
      radio.emit("logMessage", `├─ ${SUCCESS_SYMBOL} PASSED`);
      logAsTree(Object.fromEntries(statistics.test.successful), radio);

      radio.emit("logMessage", "│");
      radio.emit("logMessage", `├─ ${WARN_SYMBOL} DISCARDED`);
      logAsTree(Object.fromEntries(statistics.test.discarded), radio);

      radio.emit("logMessage", "│");
      radio.emit("logMessage", `└─ ${FAIL_SYMBOL} FAILED`);
      logAsTree(Object.fromEntries(statistics.test.failed), radio, {
        isLastSection: true,
      });
      break;
    }
  }
}

/**
 * Displays a tree structure of data.
 * @param tree The object to display as a tree.
 * @param radio The event emitter for logging messages.
 * @param options Configuration options for tree display.
 */
function logAsTree(
  tree: Record<string, any>,
  radio: EventEmitter,
  options: StatisticsTreeOptions = {}
): void {
  const { isLastSection = false, baseIndent = "   " } = options;

  const printTree = (
    node: Record<string, any>,
    indent: string = baseIndent,
    isLastParent: boolean = true,
    radio: EventEmitter
  ): void => {
    const keys = Object.keys(node);

    keys.forEach((key, index) => {
      const isLast = index === keys.length - 1;
      const connector = isLast ? "└─" : "├─";
      const nextIndent = indent + (isLastParent ? "   " : "│  ");
      const leadingChar = isLastSection ? " " : "│";

      if (typeof node[key] === "object" && node[key] !== null) {
        radio.emit(
          "logMessage",
          `${leadingChar} ${indent}${connector} ${ARROW} ${key}`
        );
        printTree(node[key], nextIndent, isLast, radio);
      } else {
        const count = node[key] as number;
        radio.emit(
          "logMessage",
          `${leadingChar} ${indent}${connector} ${key}: x${count}`
        );
      }
    });
  };

  printTree(tree, baseIndent, true, radio);
}
