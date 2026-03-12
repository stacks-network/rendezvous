;; This is a simple counter contract that increments and decrements a counter.
;; Originally copied from https://github.com/hirosystems/clarity-starter/blob/
;; bb300adf36cdaef27247fe8585a0bc69c8b69a61/contracts/counter.clar, afterwards
;; modified to introduce a bug for large values.

(define-data-var counter uint u0)

(define-constant ERR_COUNTER_MUST_BE_POSITIVE (err u401))
(define-constant ERROR_ADD_MORE_THAN_ONE (err u402))

(define-read-only (get-counter)
  (var-get counter)
)

(define-public (increment)
  (ok (var-set counter (+ (var-get counter) u1)))
)

;; This version of the increment function intentionally introduces a bug for
;; demonstration purposes. Replace the current increment function with the
;; code below to observe RendezVous testing in action.

;; (define-public (increment)
;;   (let ((current-counter (var-get counter)))
;;     (if (> current-counter u1000) ;; Introduce a bug for large values.
;;       (ok (var-set counter u0)) ;; Reset counter to zero if it exceeds 1000.
;;       (ok (var-set counter (+ current-counter u1)))
;;     )
;;   )
;; )

(define-public (decrement)
  (let ((current-counter (var-get counter)))
    (asserts! (> current-counter u0) ERR_COUNTER_MUST_BE_POSITIVE)
    (ok (var-set counter (- current-counter u1)))
  )
)

(define-public (add (n uint))
  (begin
    (asserts! (> n u1) ERROR_ADD_MORE_THAN_ONE)
    (ok (var-set counter (+ (var-get counter) n)))
  )
)

;; #[env(simnet)]
(define-map context (string-ascii 100) {
    called: uint
    ;; other data
  }
)

;; #[env(simnet)]
(define-public (update-context (function-name (string-ascii 100)) (called uint))
  (ok (map-set context function-name {called: called}))
)

;; The idea of having tests side by side to the contract is to ensure that
;; they are treated as first-class citizens.
;; Each invariant is a read-only function that starts with "invariant-".
;; Each property test is a public function that starts with "test-".

;; Invariants

;; #[env(simnet)]
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
;; #[env(simnet)]
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
;; #[env(simnet)]
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
