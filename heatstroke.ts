import { green } from "ansicolor";
import { EventEmitter } from "events";
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
          `- Contract : ${getContractNameFromContractId(
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
          `- Test Contract : ${getContractNameFromContractId(r.testContractId)}`
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
      green(
        `\nOK, ${
          type === "invariant" ? "invariants" : "properties"
        } passed after ${runDetails.numRuns} runs.\n`
      )
    );
  }
}
