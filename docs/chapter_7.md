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

**Running the `counter` invariant testing**

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

**Property test logic**

1. Record the counter value before calling `increment`.
2. Call `increment` and ensure it does not fail.
3. Check that the new counter value equals the previous value +1.
   - If this condition does not hold, the test fails with error `u404`.
   - This catches unexpected changes, such as the counter resetting.

**Running the `counter` property-based testing**

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

---

## The `cargo` Contract

The `cargo` contract is a decentralized shipment tracker found in the `example` Clarinet project. Initially, it contained a bug where the `last-shipment-id` variable was not updated when creating a new shipment. This bug has been fixed, but you can re-introduce it to see how Rendezvous detects it:

```clarity
(define-public (create-new-shipment (starting-location (string-ascii 25))
                                    (receiver principal))
  (let
    (
      (new-shipment-id (+ (var-get last-shipment-id) u1))
    )
    ;; #[filter(starting-location, receiver)]
    (map-set shipments new-shipment-id {
      location: starting-location,
      status: "In Transit",
      shipper: tx-sender,
      receiver: receiver
    })

    ;; The following line fixes the bug in the original implementation.
    ;; Comment out this line to re-introduce the bug.
    ;; (var-set last-shipment-id new-shipment-id)
    (ok "Shipment created successfully")
  )
)
```

To test the buggy version of the contract, **comment out the line that updates `last-shipment-id`**. Then, use invariants and property-based tests to detect the issue.

### Invariants

One invariant that can detect the introduced bug is:

```clarity
(define-read-only (invariant-last-shipment-id-gt-0-after-create-shipment)
  (let
    (
      (create-shipment-num-calls
        (default-to u0 (get called (map-get? context "create-new-shipment")))
      )
    )
    (if
      (is-eq create-shipment-num-calls u0)
      true
      (> (var-get last-shipment-id) u0)
    )
  )
)
```

This invariant uses the **context** utility from Rendezvous, described in the previous chapter. It enforces a fundamental rule of the `cargo` contract:

> If at least one shipment has been created, the `last-shipment-id` must be greater than 0.

**Invariant logic**

`create-shipment-num-calls = 0`:

- The invariant holds automatically (no shipments created, so no condition to check).

`create-shipment-num-calls > 0`:

- The invariant asserts that `last-shipment-id > 0`.
- If this check fails, it means `last-shipment-id` was **not updated** after creating a shipment, exposing the bug.

**Running the `cargo` invariant testing**

To run Rendezvous invariant testing against the `cargo` contract, use:

```bash
rv ./example cargo invariant
```

Using this command, Rendezvous will **randomly execute public function calls** in the `cargo` contract while **periodically checking the invariant**. If the invariant fails, it signals that `last-shipment-id` was not updated as expected, revealing the bug.

### Property-Based Tests

A property-based test that can detect the introduced bug is:

```clarity
(define-public (test-get-last-shipment-id
    (starting-location (string-ascii 25))
    (receiver principal)
  )
  (let
    ((shipment-id-before (get-last-shipment-id)))
    (unwrap!
      (create-new-shipment starting-location receiver)
      ERR_CONTRACT_CALL_FAILED
    )
    ;; Verify the last shipment ID is incremented by 1.
    (asserts!
      (is-eq (get-last-shipment-id) (+ u1 shipment-id-before))
      ERR_ASSERTION_FAILED
    )
    (ok true)
  )
)
```

This test follows a **property-based testing approach**, verifying a key property of `create-new-shipment`:

> Creating a new shipment should always increment `last-shipment-id` by 1.

**Property test logic**

1. Record the current shipment ID before calling `create-new-shipment`.
2. Call `create-new-shipment`, ensuring it does not fail.
3. Verify that `last-shipment-id` has **increased by 1**.
   - If this check fails, it means `last-shipment-id` was **not updated**, exposing the bug.

**Running the `cargo` property-based testing**

To run Rendezvous property-based tests against the `cargo` contract, use:

```bash
rv ./example cargo test
```

Using this command, Rendezvous will **randomly select and execute** property-based tests from the `cargo`'s test contract. If `test-get-last-shipment-id` is the only test in the contract, Rendezvous will immediately detect the bug.

---

## The `reverse` Contract

The `reverse` contract included in the `example` Clarinet project contains Clarity utilities for reversing lists of various types. Since it lacks public functions, **invariant testing doesn’t apply**. However, it serves as an ideal "Hello World" example for **property testing using native Clarity**—_reversing a list twice should always return the original list_.

Introducing a bug and detecting it with Rendezvous property-based tests is insightful, not just for finding the issue but for demonstrating the power of **shrinking**. Below is a malicious function that can be introduced into one of the `reverse-uint` private utilities:

```clarity
(define-read-only (reverse-uint (seq (list 127 uint)))
 (reverse-list1 seq)
)

(define-private (reverse-list1 (seq (list 127 uint)))
  (fold reverse-redx-unsigned-list seq (list))
)

(define-private (reverse-redx-unsigned-list (item uint) (seq (list 127 uint)))
  (unwrap-panic
    (as-max-len?
      (concat (list item) seq)
      u4 ;; Introduces a bug by limiting max length incorrectly.
    )
  )
)
```

This bug **reduces the maximum supported list length** in a private function, leading to an **unwrap failure runtime error** when the list exceeds the new, incorrect limit.

### Property-Based Tests

A property-based test that can detect the introduced bug is:

```clarity
(define-public (test-reverse-uint (seq (list 127 uint)))
  (begin
    (asserts!
      (is-eq seq (reverse-uint (reverse-uint seq)))
      ERR_ASSERTION_FAILED
    )
    (ok true)
  )
)
```

This test follows a **property-based testing approach**, verifying the "Hello World" of property testing:

> Reversing a list twice should always return the original list

This test example accepts a parameter, which is randomly generated for each run.

**Property test logic**

1. Verify that reversing a passed list twice is always equal to the passed list.

**Running the `reverse` property-based testing**

To run Rendezvous property-based tests against the `reverse` contract, use:

```bash
rv ./example reverse test
```

**Shrinking at its finest**

When a property-based test fails, **Rendezvous automatically shrinks the failing test case** to find **the smallest possible counterexample**. This process helps pinpoint the root cause of the bug by **removing unnecessary complexity**. Sample Rendezvous output showcasing the **shrinking** process:

```
₿     3494 Ӿ     3526   wallet_3 [FAIL] reverse test-reverse-uint [332420496,1825325546,120054597,1173935866,164214015] (runtime)
₿     3494 Ӿ     3527   wallet_3 [PASS] reverse test-reverse-uint [120054597,1173935866,164214015]
₿     3494 Ӿ     3529   wallet_3 [FAIL] reverse test-reverse-uint [0,1825325546,120054597,1173935866,164214015] (runtime)
₿     3494 Ӿ     3530   wallet_3 [PASS] reverse test-reverse-uint [120054597,1173935866,164214015]
₿     3494 Ӿ     3532   wallet_3 [PASS] reverse test-reverse-uint [0]
₿     3494 Ӿ     3533   wallet_3 [PASS] reverse test-reverse-uint [0,1173935866,164214015]
₿     3494 Ӿ     3534   wallet_3 [PASS] reverse test-reverse-uint [0,120054597,1173935866,164214015]
₿     3494 Ӿ     3535   wallet_3 [FAIL] reverse test-reverse-uint [0,0,120054597,1173935866,164214015] (runtime)
...
₿     3494 Ӿ     3537   wallet_3 [PASS] reverse test-reverse-uint [0,120054597,1173935866,164214015]
₿     3494 Ӿ     3538   wallet_3 [PASS] reverse test-reverse-uint [0]
₿     3494 Ӿ     3539   wallet_3 [PASS] reverse test-reverse-uint [0,1173935866,164214015]
₿     3494 Ӿ     3541   wallet_3 [PASS] reverse test-reverse-uint [0,0]
₿     3494 Ӿ     3542   wallet_3 [PASS] reverse test-reverse-uint [0,0,1173935866,164214015]
₿     3494 Ӿ     3543   wallet_3 [FAIL] reverse test-reverse-uint [0,0,0,1173935866,164214015] (runtime)
₿     3494 Ӿ     3545   wallet_3 [PASS] reverse test-reverse-uint [0,0,1173935866,164214015]
₿     3494 Ӿ     3546   wallet_3 [PASS] reverse test-reverse-uint [0]
₿     3494 Ӿ     3547   wallet_3 [PASS] reverse test-reverse-uint [0,1173935866,164214015]
₿     3494 Ӿ     3549   wallet_3 [PASS] reverse test-reverse-uint [0,0]
₿     3494 Ӿ     3550   wallet_3 [PASS] reverse test-reverse-uint [0,0,1173935866,164214015]
₿     3494 Ӿ     3551   wallet_3 [PASS] reverse test-reverse-uint [0,0,0]
₿     3494 Ӿ     3552   wallet_3 [PASS] reverse test-reverse-uint [0,0,0,164214015]
₿     3494 Ӿ     3553   wallet_3 [FAIL] reverse test-reverse-uint [0,0,0,0,164214015] (runtime)
₿     3494 Ӿ     3554   wallet_3 [PASS] reverse test-reverse-uint [0,0,164214015]
...
₿     3494 Ӿ     3562   wallet_3 [PASS] reverse test-reverse-uint [0,0,0,164214015]
₿     3494 Ӿ     3563   wallet_3 [PASS] reverse test-reverse-uint [0,0,0,0]
₿     3494 Ӿ     3564   wallet_3 [FAIL] reverse test-reverse-uint [0,0,0,0,0] (runtime)
₿     3494 Ӿ     3565   wallet_3 [PASS] reverse test-reverse-uint [0,0,0]
...
₿     3494 Ӿ     3574   wallet_3 [PASS] reverse test-reverse-uint [0,0,0,0]

Error: Property failed after 23 tests.
Seed : 869018352

Counterexample:
- Test Contract : reverse
- Test Function : test-reverse-uint (public)
- Arguments     : [[0,0,0,0,0]]
- Caller        : wallet_3
- Outputs       : {"type":{"response":{"ok":"bool","error":"int128"}}}

What happened? Rendezvous went on a rampage and found a weak spot:

The test function "test-reverse-uint" returned:

    Call contract function error: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.reverse::test-reverse-uint((list u0 u0 u0 u0 u0)) -> Error calling contract function: Runtime error while interpreting ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.reverse: Runtime(UnwrapFailure, Some([FunctionIdentifier { identifier: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.reverse:test-reverse-uint" }, FunctionIdentifier { identifier: "_native_:special_asserts" }, FunctionIdentifier { identifier: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.reverse:reverse-uint" }, FunctionIdentifier { identifier: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.reverse:reverse-list1" }, FunctionIdentifier { identifier: "_native_:special_fold" }, FunctionIdentifier { identifier: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.reverse:reverse-redx-unsigned-list" }, FunctionIdentifier { identifier: "_native_:native_unwrap" }]))
```

To observe shrinking in action, pay attention to the `FAIL` logs. The minimal counterexample found is:

```
[0,0,0,0,0]
```

This is exactly what we were looking for! The bug we introduced is not related to the **values** in the list but to the **list length**.

By starting with larger, more complex failing test cases and shrinking down to a list of five zeros, Rendezvous reveals that the **issue is with the number of elements, not their values**. This insight is crucial—it tells us that our bug causes failures when the list length exceeds a certain threshold, not when specific numbers are present.

This is the power of **shrinking** in property-based testing: it strips away distractions and zeroes in on the core problem.
