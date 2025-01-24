(impl-trait 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.sip-010-trait-ft-standard.sip-010-trait)

(define-fungible-token rendezvous)

;; SIP-010 methods.

(define-read-only (get-total-supply)
  (ok (ft-get-supply rendezvous))
)

(define-read-only (get-name)
  (ok "Rendezvous Token")
)

(define-read-only (get-symbol)
  (ok "rendezvous")
)

(define-read-only (get-decimals)
  (ok u6)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance rendezvous account))
)

(define-read-only (get-token-uri)
  (ok (some u""))
)

(define-public (transfer
    (amount uint)
    (sender principal)
    (recipient principal)
    (memo (optional (buff 34)))
  )
  (match (ft-transfer? rendezvous amount sender recipient)
    response (ok response)
    error (err error)
  )
)