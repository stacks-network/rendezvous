type Operator = "+" | "-" | "*" | "/";

export default function calculator(operator: Operator, inputs: number[]) {
  if (inputs.length < 2) {
    throw new Error(`inputs should have length >= 2`);
  }

  switch (operator) {
    case "+":
      return inputs.reduce((prev, curr) => prev + curr);
    case "-":
      return inputs.reduce((prev, curr) => prev - curr);
    case "*":
      return inputs.reduce((prev, curr) => prev * curr);
    case "/":
      return inputs.reduce((prev, curr) => prev / curr);
    default:
      throw new Error(`Unknown operator ${operator}`);
  }
}

(async function () {
  // Get the arguments from the command-line.
  const args = process.argv;
  // 0: NodeJs path.
  // 1: app.js path.
  // 2: command-line arg 1.
  // 3: command-line arg 2.
  // 4: command-line arg 3.
  // ...
  args.forEach(arg => {
    console.log(arg);
  });

  const manifestPath = args[2];
  console.log(`Using manifest path: ${manifestPath}`);

  // FIXME
  // --------------------------------------------------------------------------
  // With the path to the Clarinet.toml above (manifestPath), use the code off
  // of the prototype branch to read the contracts, concatenate them, and then
  // run the invariant checker, on the concatenated contracts.
  // (Add the mininum required code needed for the above task.)
  //
  // Once everything is added, we expect that running `rv <path-to-manifest>`
  // will catch the bug in the contracts.
  //
  // At this point we must consider covering the code we copied over from the
  // prototype branch with unit tests, parameterized unit tests, and property
  // -based tests. See examples in the `app.test.ts` file for how to do this.
  //
  // Once tests are added and passing we can get rid of the ice-breaker tests
  // in app.test.ts (those having to do with the calculator function) and the
  // calculator function itself, defined in app.ts.
  // --------------------------------------------------------------------------
})();
