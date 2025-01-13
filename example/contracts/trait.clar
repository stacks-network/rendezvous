(use-trait ft-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

(define-public (trait-transfer-function (transfer-data {token: <ft-trait>, amount: uint, recipient: principal}))
  (let
    (
      (ft (get token transfer-data))
    )
    (contract-call?
      ft
      transfer
      (get amount transfer-data)
      tx-sender
      (get recipient transfer-data)
      none
    )
  )
)

(define-public (no-trait-function)
  (ok true)
)
