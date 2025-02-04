;; Invariants

;; This invariant returns true regardless of the state of the contract. Its
;; purpose is to allow the demonstration of the `dialers` feature.
(define-read-only (invariant-always-true)
  true
)