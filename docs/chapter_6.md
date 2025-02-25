# Usage

This chapter explains how to use Rendezvous in different situations. By the end, you’ll know when and how to use its features effectively.

---

## Running Rendezvous

To run Rendezvous, use the following command:

```bash
rv <path-to-clarinet-project> <contract-name> <type> [--seed] [--runs] [--dial]
```

Let's break down each part of the command.

### Positional Arguments

Consider this example Clarinet project structure:

```
root
├── Clarinet.toml
├── contracts
│   ├── contract.clar
│   ├── contract.tests.clar
└── settings
    └── Devnet.toml
```

**1. Path to the Clarinet Project**

The `<path-to-clarinet-project>` is the relative or absolute path to the root directory of the Clarinet project. This is where the `Clarinet.toml` file exists. **It is not the path to the `Clarinet.toml` file itself**.

For example, if you're in the parent directory of `root`, the correct relative path would be:

```bash
rv ./root <contract-name> <type>
```

**2. Contract Name**

The `<contract-name>` is the name of the contract to be tested, as defined in `Clarinet.toml`.

For example, if `Clarinet.toml` contains:

```toml
[contracts.contract]
path = "contracts/contract.clar"
```

To test the contract named `contract`, you would run:

```bash
rv ./root contract <type>
```

**3. Testing Type**

The `<type>` argument specifies the testing technique to use. The available options are:

- `test` – Runs property-based tests.
- `invariant` – Runs invariant tests.

**Running property-based tests**

To run property-based tests for the `contract` contract, ensure that your test functions are defined in:

```
./root/contracts/contract.tests.clar
```

Then, execute:

```bash
rv ./root contract test
```

This tells Rendezvous to:

- Load the **Clarinet project** located in `./root`.
- Target the **contract** named `contract` as defined in `Clarinet.toml` by executing **property-based tests** defined in `contract.tests.clar`.

**Running invariant tests**

Invariant tests verify that certain properties of a contract remain consistent across multiple states. They are also defined in the test file:

```
./root/contracts/contract.tests.clar
```

To run invariant tests, use:

```bash
rv ./root contract invariant
```

With this command, Rendezvous will:

- Randomly **execute public function calls** in the `contract` contract.
- **Periodically check the defined invariants** to ensure the contract's internal state remains valid.

If an invariant check fails, it means the contract's state has **deviated from expected behavior**, revealing potential bugs.

### Options

Rendezvous also provides additional options to customize test execution:

**1. Customizing the Number of Runs**

By default, Rendezvous runs **100** test iterations. You can modify this using the `--runs` option:

```bash
rv root contract test --runs=500
```

This increases the number of test cases to **500**.

**2. Replaying a Specific Sequence of Events**

To reproduce a previous test sequence, you can use the `--seed` option. This ensures that the same random values are used across test runs:

```bash
rv root contract test --seed=12345
```

**3. Using Dialers**

Dialers allow you to define **pre- and post-execution functions** using JavaScript. To use a custom dialer file, run:

```bash
rv root contract test --dial=./custom-dialer.js
```

A good example of a dialer can be found in the Rendezvous repository, within the example Clarinet project, inside the [sip010.js file](https://github.com/stacks-network/rendezvous/blob/272b9247cdfcd5d12da89254e622e712d6e29e5e/example/sip010.js).

In that file, you’ll find a **post-dialer** designed as a **sanity check** for SIP-010 token contracts. It ensures that the `transfer` function correctly emits the required **print event** containing the `memo`, as specified in [SIP-010](https://github.com/stacksgov/sips/blob/6ea251726353bd1ad1852aabe3d6cf1ebfe02830/sips/sip-010/sip-010-fungible-token-standard.md?plain=1#L69).

**How Dialers Work**

During **invariant testing**, Rendezvous picks up dialers when executing public function calls:

- **Pre-dialers** run **before** each function call.
- **Post-dialers** run **after** each function call.

Both have access to an object containing:

- `selectedFunction` – The function being executed.
- `functionCall` – The result of the function call (`undefined` for **pre-dialers**).
- `clarityValueArguments` – The generated Clarity values used as arguments.

**Example: Post-Dialer for SIP-010**

Below is a **post-dialer** that verifies SIP-010 compliance by ensuring that the `transfer` function emits a print event containing the `memo`.

```js
async function postTransferSip010PrintEvent(context) {
  const { selectedFunction, functionCall, clarityValueArguments } = context;

  // Ensure this check runs only for the "transfer" function.
  if (selectedFunction.name !== "transfer") return;

  const functionCallEvents = functionCall.events;
  const memoParameterIndex = 3; // The memo parameter is the fourth argument.

  const memoGeneratedArgumentCV = clarityValueArguments[memoParameterIndex];

  // If the memo argument is `none`, there's nothing to validate.
  if (memoGeneratedArgumentCV.type === 9) return;

  // Ensure the memo argument is an option (`some`).
  if (memoGeneratedArgumentCV.type !== 10) {
    throw new Error("The memo argument must be an option type!");
  }

  // Convert the `some` value to hex for comparison.
  const hexMemoArgumentValue = cvToHex(memoGeneratedArgumentCV.value);

  // Find the print event in the function call events.
  const sip010PrintEvent = functionCallEvents.find(
    (ev) => ev.event === "print_event"
  );

  if (!sip010PrintEvent) {
    throw new Error(
      "No print event found. The transfer function must emit the SIP-010 print event containing the memo!"
    );
  }

  const sip010PrintEventValue = sip010PrintEvent.data.raw_value;

  // Validate that the emitted print event matches the memo argument.
  if (sip010PrintEventValue !== hexMemoArgumentValue) {
    throw new Error(
      `Print event memo value does not match the memo argument: ${hexMemoArgumentValue} !== ${sip010PrintEventValue}`
    );
  }
}
```

This dialer ensures that any SIP-010 token contract properly emits the **memo print event** during transfers, helping to catch deviations from the standard.

### Summary

| Argument/Option              | Description                                                                      | Example                                           |
| ---------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------- |
| `<path-to-clarinet-project>` | Path to the Clarinet project (where `Clarinet.toml` is located).                 | `rv root contract test`                           |
| `<contract-name>`            | Name of the contract to test (as in `Clarinet.toml`).                            | `rv root contract test`                           |
| `<type>`                     | Type of test (`test` for property-based tests, `invariant` for invariant tests). | `rv root contract test`                           |
| `--runs=<num>`               | Sets the number of test iterations (default: 100).                               | `rv root contract test --runs=500`                |
| `--seed=<num>`               | Uses a specific seed for reproducibility.                                        | `rv root contract test --seed=12345`              |
| `--dial=<file>`              | Loads JavaScript dialers from a file for pre/post-processing.                    | `rv root contract test --dial=./custom-dialer.js` |
