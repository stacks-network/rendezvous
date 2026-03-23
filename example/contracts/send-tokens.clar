(use-trait ft-trait 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.sip-010-trait-ft-standard.sip-010-trait)

(define-public (send-tokens
    (transfers (list 5 {token: <ft-trait>, to: principal, amount: uint}))
  )
  (ok (map transfer transfers))
)

(define-private (transfer
    (one-transfer {token: <ft-trait>, to: principal, amount: uint})
  )
  (let
    (
      (ft (get token one-transfer))
      (to (get to one-transfer))
      (amount (get amount one-transfer))
    )
    (contract-call? ft transfer amount tx-sender to none))
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

;; #[env(simnet)]
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

;; #[env(simnet)]
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
