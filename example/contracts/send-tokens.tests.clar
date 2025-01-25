;; Invariants

(define-read-only (invariant-token-supply-vs-balance (address principal))
  (let
    (
      (total-supply
        (unwrap-panic (contract-call? .rendezvous-token get-total-supply)))
      (user-balance
        (unwrap-panic
          (contract-call?
            .rendezvous-token
            get-balance
            address
          )
        )
      )
    )
    (<= user-balance total-supply)
  )
)

;; Properties

(define-public (test-transfer
    (token <ft-trait>) (to principal) (amount uint)
  )
  (let
    (
      (sender-balance-before
        (unwrap-panic (contract-call? token get-balance tx-sender)))
      (transfer-result
        (transfer {token: token, to: to, amount: amount}))
      (sender-balance-after
        (unwrap-panic (contract-call? token get-balance tx-sender)))
    )
    (match transfer-result
      result
        (ok
          (is-eq
            sender-balance-after
            (- sender-balance-before amount)
          )
        )
      error (ok false)
    )
  )
)