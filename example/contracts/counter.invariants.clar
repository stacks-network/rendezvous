;; The idea of having invariants side by side to the contract
;; is to ensure that they are treated as first-class citizens.
;; Each invariant is a function that starts with "invariant-".

(define-read-only (invariant-counter-gt-zero)
  (let
      ((increment-num-calls (default-to u0 (get called (map-get? context "increment"))))
       (decrement-num-calls (default-to u0 (get called (map-get? context "decrement")))))
    (if (> increment-num-calls decrement-num-calls)
        (> (var-get counter) u0)
        true)))
