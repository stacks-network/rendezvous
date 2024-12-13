;; The idea of having tests side by side to the contract is to ensure that
;; they are treated as first-class citizens.
;; Each invariant is a read-only function that starts with "invariant-".
;; Each property test is a public function that starts with "test-".

;; Invariants

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

;; Properties

;; This test catches the bug in the counter contract.
(define-public (test-increment)
  (let
    ((counter-before (get-counter)))
    (unwrap-panic (increment))
    (asserts! (is-eq (get-counter) (+ counter-before u1)) (err u404))
    (ok true)
  )
)

;; Test that takes a parameter. This will be run using property-based
;; techniques.
(define-public (test-add (n uint))
  (let
    ((counter-before (get-counter)))
    (ok
      (if
        (<= n u1)
        ;; Discard the test if `add` cannot be called with the given parameter.
        false
        (begin
          (try! (add n))
          (asserts! (is-eq (get-counter) (+ counter-before n)) (err u403))
          true
        )
      )
    )
  )
)
