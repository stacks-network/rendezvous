(use-trait ft-trait 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.sip-010-trait-ft-standard.sip-010-trait)

(define-public (transfer-many
    (transfers-list
      (list 5 {token: <ft-trait>, recipient: principal, amount: uint})
    )
  )
  (ok (map transfer transfers-list))
)

(define-private (transfer
    (one-transfer {token: <ft-trait>, recipient: principal, amount: uint})
  )
  (let
    (
      (ft (get token one-transfer))
      (recipient (get recipient one-transfer))
      (amount (get amount one-transfer))
    )
    (contract-call? ft transfer amount tx-sender recipient none))
)
