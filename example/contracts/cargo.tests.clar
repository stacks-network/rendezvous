(define-constant ERR_ASSERTION_FAILED (err 1))
(define-constant ERR_CONTRACT_CALL_FAILED (err 2))

(define-public (test-create-new-shipment (starting-location (string-ascii 25)) (receiver principal))
    (let ((shipment-id-before (contract-call? .cargo get-last-shipment-id)))
        (unwrap! (contract-call? .cargo create-new-shipment starting-location receiver) ERR_CONTRACT_CALL_FAILED)
        (asserts! (is-eq (contract-call? .cargo get-last-shipment-id) (+ shipment-id-before u1)) ERR_ASSERTION_FAILED)
        (ok true)))
