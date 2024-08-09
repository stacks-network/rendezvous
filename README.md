<div align="center">
<img width="304" src="https://raw.githubusercontent.com/moodmosaic/nikosbaxevanis.com/gh-pages/images/rv.png" />
</div>

## Rendezvous `rv`: The Clarity Fuzzer

Rendezvous `rv` is a Clarity fuzzer designed to cut through your smart contract's defenses with precision. Uncover vulnerabilities with unmatched power and intensity. Get ready to meet your contract's vulnerabilities head-on.

### Inspiration

The `rv` fuzzer is inspired by the paper _"Testing the Hard Stuff and Staying Sane"_ by John Hughes[^1]. It helps ensure your smart contracts are robust. To do this, you'll need Clarity invariants that define the essential properties your contracts must always meet.

### Example Directory Structure

```
root
├── Clarinet.toml
├── contracts
│   ├── contract.clar
│   ├── contract.invariants.clar
└── settings
    └── Devnet.toml
```

### Usage

Run the fuzzer with the following command:

```
rv <root>
```

This will execute the fuzzing process, attempting to falsify the invariants.

---

### Example

Here is an example of a Clarity invariant designed to identify a bug in a smart contract:

```clarity
(define-read-only (invariant-counter-gt-zero)
  (let
      ((increment-num-calls (default-to u0 (get called (map-get? context "increment"))))
       (decrement-num-calls (default-to u0 (get called (map-get? context "decrement")))))
    (if (> increment-num-calls decrement-num-calls)
        (> (var-get counter) u0)
        true)))
```

To see how this and other invariants work in action, and to get a broader understanding of their implementation, you can run `rv` against the example Clarinet project:

```
rv example
```

---

[^1]: Hughes, J. (2004). _Testing the Hard Stuff and Staying Sane_. In Proceedings of the ACM SIGPLAN Workshop on Haskell (Haskell '04).
