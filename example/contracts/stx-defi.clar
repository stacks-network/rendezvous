;; Originally copied from hirosystems clarity-examples repository, further
;; formatted and cleaned up to adhere to Rendezvous style guide:
;; https://github.com/hirosystems/clarity-examples/blob/ccd9ecf0bf136d7f28ef116706ed2936f6d8781a/examples/stx-defi/contracts/stx-defi.clar

(define-map deposits
  { owner: principal }
  { amount: uint }
)

(define-map loans
  principal
  {
    amount: uint,
    last-interaction-block: uint,
  }
)

(define-data-var total-deposits uint u0)
(define-data-var pool-reserve uint u0)
(define-data-var loan-interest-rate uint u10)

(define-constant err-no-interest (err u100))
(define-constant err-overpay (err u200))
(define-constant err-overborrow (err u300))

(define-public (deposit (amount uint))
  (let
    (
      (current-balance
        (default-to u0 (get amount (map-get? deposits { owner: tx-sender })))
      )
    )
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set deposits
      { owner: tx-sender } { amount: (+ current-balance amount) }
    )
    (var-set total-deposits (+ (var-get total-deposits) amount))
    (ok true)
  )
)

(define-public (borrow (amount uint))
  (let
    (
      (user-deposit
        (default-to u0 (get amount (map-get? deposits { owner: tx-sender })))
      )
      (allowed-borrow (/ user-deposit u2))
      (current-loan-details
        (default-to
          {
            amount: u0,
            last-interaction-block: u0,
          }
          (map-get? loans tx-sender)
        )
      )
      (accrued-interest
        (calculate-accrued-interest
          (get amount current-loan-details)
          (get last-interaction-block current-loan-details)
        )
      )
      (total-due
        (+ (get amount current-loan-details) (unwrap-panic accrued-interest))
      )
      ;; The following commented line fixes the bug in the original
      ;; implementation. Uncommenting it and commenting out the next line
      ;; would re-introduce the bug to see Rendezvous in action.
      (new-loan (+ (get amount current-loan-details) amount))
      ;; (new-loan (+ amount))
    )
    (asserts! (<= new-loan allowed-borrow) err-overborrow)
    (let
      ((recipient tx-sender))
      (try! (as-contract (stx-transfer? amount tx-sender recipient)))
    )
    (map-set loans
      tx-sender
      {
        amount: new-loan,
        last-interaction-block: burn-block-height,
      }
    )
    (ok true)
  )
)

(define-read-only (get-balance-by-sender)
  (ok (map-get? deposits { owner: tx-sender }))
)

(define-read-only (get-balance)
  (ok (var-get total-deposits))
)

(define-read-only (get-amount-owed)
  (let
    (
      (current-loan-details
        (default-to
          {
            amount: u0,
            last-interaction-block: u0,
          }
          (map-get? loans tx-sender)
        )
      )
      (accrued-interest
        (calculate-accrued-interest
          (get amount current-loan-details)
          (get last-interaction-block current-loan-details)
        )
      )
      (total-due
        (+ (get amount current-loan-details) (unwrap-panic accrued-interest))
      )
    )
    (ok total-due)
  )
)

(define-public (repay (amount uint))
  (let
    (
      (current-loan-details
        (default-to
          {
            amount: u0,
            last-interaction-block: u0,
          }
          (map-get? loans tx-sender)
        )
      )
      (accrued-interest
        (unwrap!
          (calculate-accrued-interest
            (get amount current-loan-details)
            (get last-interaction-block current-loan-details)
          )
          err-no-interest
        )
      )
      (total-due (+ (get amount current-loan-details) accrued-interest))
    )
    (asserts! (>= total-due amount) err-overpay)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set loans
      tx-sender
      {
        amount: (- total-due amount),
        last-interaction-block: burn-block-height,
      }
    )
    (var-set pool-reserve (+ (var-get pool-reserve) accrued-interest))
    (ok true)
  )
)

(define-public (claim-yield)
  (let
    (
      (user-deposit
        (default-to u0 (get amount (map-get? deposits { owner: tx-sender })))
      )
      (yield-amount
        (/ (* (var-get pool-reserve) user-deposit) (var-get total-deposits))
      )
    )
    (let
      ((recipient tx-sender))
      (try! (as-contract (stx-transfer? yield-amount tx-sender recipient)))
    )
    (var-set pool-reserve (- (var-get pool-reserve) yield-amount))
    (ok true)
  )
)

(define-private (calculate-accrued-interest
    (amount uint)
    (start-block uint)
  )
  (let
    (
      (elapsed-blocks (- burn-block-height start-block))
      (interest
        (/ (* amount (var-get loan-interest-rate) elapsed-blocks) u10000)
      )
    )
    (asserts! (not (is-eq start-block u0)) (ok u0))
    (ok interest)
  )
)
