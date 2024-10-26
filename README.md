<div align="center">
<img width="304" src="https://raw.githubusercontent.com/moodmosaic/nikosbaxevanis.com/gh-pages/images/rv.png" />
</div>

## Rendezvous `rv`: The Clarity Fuzzer

Rendezvous `rv` is a Clarity fuzzer designed to cut through your smart contract's defenses with precision. Uncover vulnerabilities with unmatched power and intensity. Get ready to meet your contract's vulnerabilities head-on.

### Inspiration

The `rv` fuzzer, inspired by John Hughes' paper _"Testing the Hard Stuff and Staying Sane"_[^1], ensures contract robustness with Clarity invariants and tests.

### Example Directory Structure

```
root
├── Clarinet.toml
├── contracts
│   ├── contract.clar
│   ├── contract.invariants.clar
│   ├── contract.tests.clar
└── settings
    └── Devnet.toml
```

### Usage

Run the fuzzer with the following command:

```
rv <path-to-clarinet-project> <contract-name>
```

This will execute the fuzzing process, attempting to falsify invariants or tests.

**Options:**
- `--seed` – The seed to use for the replay functionality.
- `--path` – The path to use for the replay functionality.
- `--type` – The type to use for exercising the contracts.
              `test` or `invariant` (default: `invariant`)

---

### Example (`--type=test`)

Here's an example of a test that checks reversing a list twice returns the original:

```clarity
(define-public (test-reverse-list (seq (list 127 uint)))
  (begin
    (asserts!
      (is-eq seq
        (contract-call? .reverse reverse-uint
          (contract-call? .reverse reverse-uint seq)))
      (err u999))
    (ok true)))
```

You can run property-based tests using `rv` with the following command:

```
rv example reverse --type=test
```

---

### Example (`--type=invariant`)

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
rv example counter --type=invariant
```

---

[^1]: Hughes, J. (2004). _Testing the Hard Stuff and Staying Sane_. In Proceedings of the ACM SIGPLAN Workshop on Haskell (Haskell '04).
