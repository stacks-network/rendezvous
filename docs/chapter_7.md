# Examples

The Rendezvous repository includes a Clarinet project called `example`, which demonstrates different ways to test Clarity smart contracts using native Clarity. Each contract, such as `contractName.clar`, has a corresponding test contract, `contractName.tests.clar`, containing its invariants and property-based tests.

---

## The `counter` Contract

The `counter` contract is a simple Clarity example found in the `example` Clarinet project. It has no known vulnerabilities. However, to see how Rendezvous works, we can **introduce a bug** into the `increment` function. This bug resets the counter to `0` when the counter value exceeds `1000`. The faulty `increment` function is already included (but commented out) in the `counter` contract:

```clarity
(define-public (increment)
  (let
    (
      (current-counter (var-get counter))
    )
    (if
      (> current-counter u1000) ;; Introduce a bug for large values.
      (ok (var-set counter u0)) ;; Reset counter to zero if it exceeds 1000.
      (ok (var-set counter (+ current-counter u1)))
    )
  )
)
```

To test the buggy version of the contract, replace the valid `increment` function with the faulty version. Then, you can write Clarity invariants or property-based tests to detect the issue.

### Invariants

One invariant that can detect the introduced bug is:

```clarity
(define-read-only (invariant-counter-gt-zero)
  (let
    (
      (increment-num-calls
        (default-to u0
          (get called (map-get? context "increment"))
        )
      )
      (decrement-num-calls
        (default-to u0
          (get called (map-get? context "decrement"))
        )
      )
    )
    (if
      (<= increment-num-calls decrement-num-calls)
      true
      (> (var-get counter) u0)
    )
  )
)
```

This invariant uses the **context** utility from Rendezvous, described in the previous chapter. It establishes a fundamental rule for the counter contract:

> If, at the time of the check, the `increment` function has been called successfully more times than `decrement`, the counter value should be greater than 0.

**Invariant logic**

`increment-num-calls ≤ decrement-num-calls`:

- The invariant automatically holds.
- This case means decrements occurred at least as many times as increments, so the invariant does not enforce any condition.

`increment-num-calls > decrement-num-calls`:

- The invariant asserts that `counter > u0`.
- This ensures that, despite more increment calls, the counter remains positive.

**Running the counter invariant testing**

To run Rendezvous invariant testing against the `counter` contract, use:

```bash
rv ./example counter invariant
```

Using this command, Rendezvous will **randomly execute public function calls** in the `counter` contract while **periodically checking the invariant**. If the invariant fails, it indicates that the contract's internal state has deviated from expected behavior, exposing the bug in the faulty `increment` function.

### Property-Based Tests

One property test that can detect the introduced bug is:

```clarity
(define-public (test-increment)
  (let
    (
      (counter-before (get-counter))
    )
    (unwrap-panic (increment))
    (asserts! (is-eq (get-counter) (+ counter-before u1)) (err u404))
    (ok true)
  )
)
```

This test follows a **property-based testing approach**, where a general property of the `increment` function is tested across different scenarios.

> The counter should always increase by 1 after a successful call to `increment`.

If the test fails, it means the counter did not increment as expected, revealing unintended behavior such as the counter resetting to `0`.

**Property Test Logic**

1. Record the counter value before calling `increment`.
2. Call `increment` and ensure it does not fail.
3. Check that the new counter value equals the previous value +1.
   - If this condition does not hold, the test fails with error `u404`.
   - This catches unexpected changes, such as the counter resetting.

**Running the counter property-based testing**

To run Rendezvous property-based tests against the counter contract, use:

```bash
rv ./example counter test
```

Using this command, Rendezvous will **randomly select and execute** property-based tests from the `counter`'s test contract. This process will detect the bug in the faulty increment function. However, if the test contract contains only `test-increment`, **the number of runs must be increased**. By default, Rendezvous executes **100 runs**, which is not sufficient to expose the issue.

To reliably catch the bug, set the `--runs` options to at least **1002**:

```bash
rv ./example counter test --runs=1002
```

This ensures that enough test cases are executed to trigger the `counter` reset condition.
