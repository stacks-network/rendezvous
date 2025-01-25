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
