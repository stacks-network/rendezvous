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
