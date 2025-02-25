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

For example, if you want to use Rendezvous to test the `contract` contract using **property-based testing**, you need to ensure that your test functions are defined in:

```
./root/contracts/contract.tests.clar
```

Then, run the following command:

```bash
rv ./root contract test
```

This tells Rendezvous to:

- Load the **Clarinet project** located in `./root`.
- Target the **contract** named `contract` from `Clarinet.toml` by executing **property-based tests** defined in `contract.tests.clar`.

If you want to run **invariant tests**, which check that the contract maintains expected properties across multiple states, use:

```bash
rv ./root contract invariant
```

With this command, Rendezvous will:

- Randomly **execute public function calls** in the `contract` contract.
- **Periodically check the invariants** to ensure the contract's internal state remains valid.

If the invariant check fails, it means the contract's state has **deviated from expected behavior**, helping to uncover potential bugs.
