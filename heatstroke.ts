/**
 * Heatstrokes Reporter
 *
 * This reporter integrates with `fast-check` to provide detailed and formatted
 * outputs for failed property-based tests. It captures key information such as
 * the contract, functions, arguments, outputs, and the specific invariant that
 * failed, enabling quick identification of issues.
 */

/**
 * Reports the details of a failed property-based test run.
 *
 * This function provides a detailed report when a fuzzing test fails including
 * the contract, functions, arguments, outputs, and the specific invariant that
 * failed.
 *
 * @param runDetails - The details of the test run provided by fast-check.
 * @property runDetails.failed - Indicates if the property test failed.
 * @property runDetails.counterexample - The input that caused the failure.
 * @property runDetails.numRuns - The number of test cases that were run.
 * @property runDetails.seed - The seed used to generate the test cases.
 * @property runDetails.path - The path to reproduce the failing test.
 * @property runDetails.error - The error thrown during the test.
 */

import { EventEmitter } from "events";
import { getContractNameFromRendezvousId } from "./invariant";
import { green } from "ansicolor";

export function reporter(
  //@ts-ignore
  runDetails,
  radio: EventEmitter,
  type: "invariant" | "test"
) {
  if (runDetails.failed) {
    // Report general run data.
    const r = runDetails.counterexample[0];

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
        // Report specific run data for the invariant testing type.
        radio.emit("logFailure", `\nCounterexample:`);
        radio.emit(
          "logFailure",
          `- Contract : ${getContractNameFromRendezvousId(
            r.rendezvousContractId
          )}`
        );
        radio.emit(
          "logFailure",
          `- Function : ${r.selectedFunction.name} (${r.selectedFunction.access})`
        );
        radio.emit(
          "logFailure",
          `- Arguments: ${JSON.stringify(r.functionArgsArb)}`
        );
        radio.emit("logFailure", `- Caller   : ${r.sutCaller[0]}`);
        radio.emit(
          "logFailure",
          `- Outputs  : ${JSON.stringify(r.selectedFunction.outputs)}`
        );
        radio.emit(
          "logFailure",
          `- Invariant: ${r.selectedInvariant.name} (${r.selectedInvariant.access})`
        );
        radio.emit(
          "logFailure",
          `- Arguments: ${JSON.stringify(r.invariantArgsArb)}`
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
          // @ts-ignore
          .map((line) => "    " + line)
          .join("\n")}\n`;

        radio.emit("logFailure", formattedError);

        break;
      }
      case "test": {
        // Report specific run data for the property testing type.
        radio.emit("logFailure", `\nCounterexample:`);
        radio.emit(
          "logFailure",
          `- Test Contract : ${r.testContractId.split(".")[1]}`
        );
        radio.emit(
          "logFailure",
          `- Test Function : ${r.selectedTestFunction.name} (${r.selectedTestFunction.access})`
        );
        radio.emit(
          "logFailure",
          `- Arguments     : ${JSON.stringify(r.functionArgsArb)}`
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
          // @ts-ignore
          .map((line) => "    " + line)
          .join("\n")}\n`;

        radio.emit("logFailure", formattedError);
        break;
      }
    }
  } else {
    radio.emit(
      "logMessage",
        `\nOK, ${
          type === "invariant" ? "invariants" : "properties"
        } passed after ${runDetails.numRuns} runs.\n`
    );
  }
}
