<div align="center">
<img width="304" src="https://raw.githubusercontent.com/moodmosaic/nikosbaxevanis.com/gh-pages/images/rv.png" />
</div>

## Rendezvous `rv`: The Clarity Fuzzer

Rendezvous `rv` is a Clarity fuzzer designed to cut through your smart contract's defenses with precision. Uncover vulnerabilities with unmatched power and intensity. Get ready to meet your contract's vulnerabilities head-on.

### Prerequisites

- **Node.js**: Supported versions include 18, 20, and 22. Other versions may work, but they are untested.

### Inspiration

The `rv` fuzzer, inspired by John Hughes' paper _"Testing the Hard Stuff and Staying Sane"_[^1], ensures contract robustness with Clarity invariants and tests.

### Example Directory Structure

```
root
├── Clarinet.toml
├── contracts
│   ├── contract.clar
│   ├── contract.tests.clar
└── settings
    └── Devnet.toml
```

### Installation

---

**Install the package locally**

```
npm install "https://github.com/stacks-network/rendezvous.git"
npm run build
```

Run the fuzzer locally:

```
npx rv <path-to-clarinet-project> <contract-name> <type>
```

---

**Install the package globally**

```
git clone https://github.com/stacks-network/rendezvous
npm install
npm install --global .
```

Run the fuzzer from anywhere on your system:

```
rv <path-to-clarinet-project> <contract-name> <type>
```

---

### Configuration

**Positional arguments:**

- `path-to-clarinet-project` - Path to the root directory of the Clarinet project (where Clarinet.toml exists).
- `contract-name` - Name of the contract to test, per Clarinet.toml.
- `type` - Type of test to run. Options:
  - `test` - Run property-based tests.
  - `invariant` - Run invariant tests.

**Options:**

- `--seed` – The seed to use for the replay functionality.
- `--path` – The path to use for the replay functionality.
- `--runs` – The number of test iterations to use for exercising the contracts.
  (default: `100`)

---

### Example (`test`)

Here's an example of a test that checks reversing a list twice returns the original:

```clarity
(define-public (test-reverse-list (seq (list 127 uint)))
  (begin
    (asserts!
      (is-eq seq
        (reverse-uint
          (reverse-uint seq)))
      (err u999))
    (ok true)))
```

You can run property-based tests using `rv` with the following command:

```
rv example reverse test
```

---

### Example (`invariant`)

Here's a Clarity invariant to detect a bug in the example counter contract:

```clarity
(define-read-only (invariant-counter-gt-zero)
  (let
      ((increment-num-calls (default-to u0 (get called (map-get? context "increment"))))
       (decrement-num-calls (default-to u0 (get called (map-get? context "decrement")))))
    (if (> increment-num-calls decrement-num-calls)
        (> (var-get counter) u0)
        true)))
```

You can run invariant tests using `rv` with the following command:

```
rv example counter invariant
```

---

[^1]: Hughes, J. (2004). _Testing the Hard Stuff and Staying Sane_. In Proceedings of the ACM SIGPLAN Workshop on Haskell (Haskell '04).
