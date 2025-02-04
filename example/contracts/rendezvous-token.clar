(impl-trait 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.sip-010-trait-ft-standard.sip-010-trait)

(define-fungible-token rendezvous)

(define-constant deployer tx-sender)

(define-constant ERR_UNAUTHORIZED (err u400))

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
  (begin
    ;; This print event is required for rendezvous to be a SIP-010 compliant
    ;; fungible token. Comment out this line and run the following command to
    ;; see the `dialers` in action:
    ;; ```rv example rendezvous-token invariant --dial=example/sip010.js```
    (match memo to-print (print to-print) 0x)
    (match (ft-transfer? rendezvous amount sender recipient)
      response (ok response)
      error (err error)
    )
  )
)

(define-public (mint (recipient principal) (amount uint))
  (begin
    (asserts! (is-eq contract-caller deployer) ERR_UNAUTHORIZED)
    (ft-mint? rendezvous amount recipient)
  )
)