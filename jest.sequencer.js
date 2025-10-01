const Sequencer = require("@jest/test-sequencer").default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // The `app.tests.ts` test must run first. It creates the cache and the
    // deployment plan, so other tests that create isolated simnet environments
    // do not have to repeat the setup. This avoids rate limiting from the
    // Hiro API.
    const order = ["app.tests.ts"];

    return tests.sort((testA, testB) => {
      const aName = testA.path.split("/").pop();
      const bName = testB.path.split("/").pop();

      const aIndex = order.indexOf(aName);
      const bIndex = order.indexOf(bName);

      // Prioritize the test in the order array.
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
    });
  }
}

module.exports = CustomSequencer;
