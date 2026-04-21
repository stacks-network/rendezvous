# Library API

Rendezvous can be used as a library for building custom property-based testing strategies in TypeScript. Instead of relying solely on the `rv` CLI, you can import its argument generation capabilities directly and compose your own [fast-check](https://github.com/dubzzz/fast-check) properties.

This is useful when you need full control over the testing loop: custom assertions, stateful setups, multi-contract interactions, or integration with existing test frameworks like Vitest or Jest.

## Installation

```bash
npm install @stacks/rendezvous
```

Rendezvous ships with TypeScript declarations. You also need `fast-check` and `@stacks/clarinet-sdk` (both are already dependencies).

## API

### `getContractFunction(simnet, contractName, functionName, deployer?)`

Retrieves a function interface from a deployed contract. The returned interface is enriched with trait reference data when applicable.

**Parameters:**

| Parameter      | Type     | Description                                                |
| -------------- | -------- | ---------------------------------------------------------- |
| `simnet`       | `Simnet` | The simnet instance from `initSimnet`.                     |
| `contractName` | `string` | The contract name (e.g., `"counter"`).                     |
| `functionName` | `string` | The function name (e.g., `"increment"`).                   |
| `deployer`     | `string` | Optional. Deployer address. Defaults to `simnet.deployer`. |

**Returns:** `EnrichedContractInterfaceFunction`

**Throws** if the contract or function is not found.

### `strategyFor(simnet, fn)`

Returns a fast-check arbitrary that produces `ClarityValue[]` arrays — ready for use with `simnet.callPublicFn` or `simnet.callReadOnlyFn`.

Handles all Clarity types automatically: `uint`, `int`, `bool`, `principal`, `buff`, `string-ascii`, `string-utf8`, `list`, `tuple`, `optional`, `response`, and `trait_reference` (including recursive/nested structures like list of tuples or optional of response).

**Parameters:**

| Parameter | Type                                | Description                                    |
| --------- | ----------------------------------- | ---------------------------------------------- |
| `simnet`  | `Simnet`                            | The simnet instance.                           |
| `fn`      | `EnrichedContractInterfaceFunction` | Function interface from `getContractFunction`. |

**Returns:** `fc.Arbitrary<ClarityValue[]>`

Principal addresses and trait implementations are resolved from the simnet automatically.

## Example

```ts
import { initSimnet } from "@stacks/clarinet-sdk";
import { getContractFunction, strategyFor } from "@stacks/rendezvous";
import fc from "fast-check";

const simnet = await initSimnet("./Clarinet.toml");
const add = getContractFunction(simnet, "counter", "add");
const arb = strategyFor(simnet, add);

fc.assert(
  fc.property(arb, (args) => {
    const { result } = simnet.callPublicFn(
      `${simnet.deployer}.counter`,
      "add",
      args,
      simnet.deployer,
    );
    return result.type !== "err";
  }),
);
```

## Custom Deployer

If the contract is deployed by an address other than the default deployer, pass it explicitly:

```ts
const fn = getContractFunction(simnet, "my-contract", "my-fn", "ST1OTHER...");
```

## Functions With No Arguments

For functions that take no parameters, `strategyFor` returns an arbitrary producing empty arrays:

```ts
const increment = getContractFunction(simnet, "counter", "increment");
const arb = strategyFor(simnet, increment);
// arb always produces [].
```

## Supported Clarity Types

| Clarity Type      | Generated As                                     |
| ----------------- | ------------------------------------------------ |
| `uint`            | Natural numbers                                  |
| `int`             | Integers                                         |
| `bool`            | Booleans                                         |
| `principal`       | Random address from simnet accounts              |
| `buff`            | Hex-encoded buffers (respects max length)        |
| `string-ascii`    | ASCII strings (respects max length)              |
| `string-utf8`     | UTF-8 strings (respects max length)              |
| `list`            | Arrays of the element type (recursive)           |
| `tuple`           | Records with named fields (recursive)            |
| `optional`        | `none` or `some` of the wrapped type (recursive) |
| `response`        | `ok` or `error` branch (recursive)               |
| `trait_reference` | Random contract implementing the trait           |
