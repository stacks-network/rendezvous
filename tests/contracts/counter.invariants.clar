;; The idea of having invariants side by side to the contract
;; is to ensure that they are treated as first-class citizens.
;; Each invariant is a function that starts with "invariant-".

(define-read-only (invariant-counter-non-negative)
  ;; Ensure counter is always non-negative.
  (>= (var-get counter) u0)
)

(define-read-only (invariant-no-overflow)
  ;; Assuming Clarity's uint is properly bounded, this should always be true.
  (<= (var-get counter) u10000000000000000000000)
)

(define-read-only (invariant-counter-not-reset-unexpectedly)
  ;; Ensure counter is not unexpectedly reset to 0 when incrementing.
  (not (is-eq (var-get counter) u0))
)
