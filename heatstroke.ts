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
// @ts-ignore
export function reporter(runDetails) {
  if (runDetails.failed) {
    const r = runDetails.counterexample[0];

    console.error(`Error: Property failed after ${runDetails.numRuns} tests.`);
    console.error(`Seed : ${runDetails.seed}`);
    if (runDetails.path) {
      console.error(`Path : ${runDetails.path}`);
    }

    console.error(`\nCounterexample:`);
    // FIXME: Derive the SUT contract name from rendezvousId.
    console.error(`- Contract : ${r.rendezvousId}`);
    console.error(
      `- Function : ${r.selectedFunction.name} (${r.selectedFunction.access})`
    );
    console.error(`- Arguments: ${JSON.stringify(r.functionArgsArb)}`);
    console.error(`- Outputs  : ${JSON.stringify(r.selectedFunction.outputs)}`);
    console.error(
      `- Invariant: ${r.selectedInvariant.name} (${r.selectedInvariant.access})`
    );
    console.error(`- Arguments: ${JSON.stringify(r.invariantArgsArb)}`);

    console.error(
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

    console.error(formattedError);
  }
}
