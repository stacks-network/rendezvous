(define-public (test-deposit (amount uint))
  (if
    (and (>= (stx-get-balance tx-sender) amount) (> amount u0))
    (let
      (
        (initial-balance
          (default-to u0 (get amount (map-get? deposits { owner: tx-sender })))
        )
      )
      (unwrap! (deposit amount) (err "Deposit call failed"))
      (let
        (
          (updated-balance
            (default-to
              u0
              (get amount (map-get? deposits { owner: tx-sender }))
            )
          )
        )
        (asserts!
          (is-eq
            (+ initial-balance amount)
            updated-balance
          )
          (err "Critical error: Deposit amount not updated correctly")
        )
        (ok true)
      )
    )
    (ok false)
  )
)

(define-public (test-borrow (amount uint))
  (if
    (and
      (> amount u0)
      (>= (stx-get-balance tx-sender) amount)
      (<=
        (+
          (get amount
            (default-to
              { amount: u0, last-interaction-block: u0 }
              (map-get? loans tx-sender )
            )
          )
          amount
        )
        (/
          (default-to u0 (get amount (map-get? deposits { owner: tx-sender })))
          u2
        )
      )
    )
    (let
      (
        (initial-loan
          (default-to
            { amount: u0, last-interaction-block: u0 }
            (map-get? loans tx-sender)
          )
        )
      )
      (unwrap! (borrow amount) (err "Borrow call failed"))
      (let
        (
          (updated-loan
            (default-to
              { amount: u0, last-interaction-block: u0 }
              (map-get? loans tx-sender)
            )
          )
        )
        (asserts!
          (is-eq
            (+ (get amount initial-loan) amount)
            (get amount updated-loan)
          )
          (err "Critical error: Loan amount not updated correctly")
        )
        (ok true)
      )
    )
    (ok false)
  )
)