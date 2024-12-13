;; Invariants

(define-read-only (invariant-last-shipment-id-gt-0-after-create-shipment)
  (let 
    (
      (create-shipment-num-calls
        (default-to u0 (get called (map-get? context "create-new-shipment")))
      )
    )
    (if
      (is-eq create-shipment-num-calls u0)
      true
      (> (var-get last-shipment-id) u0)
    )
  )
)

;; Properties

;; Constants for errors
(define-constant ERR_ASSERTION_FAILED (err 1))
(define-constant ERR_CONTRACT_CALL_FAILED (err 2))
(define-constant ERR_SHIPMENT_NOT_FOUND (err 3))

(define-public (test-create-new-shipment
    (starting-location (string-ascii 25))
    (receiver principal)
  )
  (let
    (
      (shipment-id-before (get-last-shipment-id))
      ;; Call create-new-shipment and assert based on the result.
      (result
        (unwrap!
          (create-new-shipment starting-location receiver)
          ERR_CONTRACT_CALL_FAILED
        )
      )
    )
    (asserts!
      (is-eq result "Shipment created successfully")
      ERR_ASSERTION_FAILED
    )
    (ok true)
  )
)

(define-public (test-get-last-shipment-id
    (starting-location (string-ascii 25))
    (receiver principal)
  )
  (let
    ((shipment-id-before (get-last-shipment-id)))
    (unwrap!
      (create-new-shipment starting-location receiver)
      ERR_CONTRACT_CALL_FAILED
    )
    ;; Verify the last shipment ID is incremented by 1.
    (asserts!
      (is-eq (get-last-shipment-id) (+ u1 shipment-id-before))
      ERR_ASSERTION_FAILED
    )
    (ok true)
  )
)

(define-public (test-update-shipment
    (starting-location (string-ascii 25))
    (receiver principal)
    (new-location (string-ascii 25))
  )
  (let
    (
      (create-result
        (unwrap!
          (create-new-shipment starting-location receiver)
          ERR_CONTRACT_CALL_FAILED
        )
      )
      (shipment-id (get-last-shipment-id))
      (update-result
        (unwrap!
          (update-shipment shipment-id new-location)
          ERR_CONTRACT_CALL_FAILED
        )
      )
      (updated-shipment
        (default-to
          {
            status: "Does not exist",
            location: "Does not exist",
            shipper: tx-sender,
            receiver: tx-sender
          }
          (get-shipment-optional shipment-id)
        )
      )
    )
    ;; Verify the location is updated.
    (asserts!
      (is-eq (get location updated-shipment) new-location)
      ERR_ASSERTION_FAILED
    )
    (ok true)
  )
)

(define-public (test-get-shipment
    (starting-location (string-ascii 25))
    (receiver principal)
  )
  (let
    (
      (create-result
        (unwrap!
          (create-new-shipment starting-location receiver)
          ERR_CONTRACT_CALL_FAILED
        )
      )
      (shipment-id (get-last-shipment-id))
      (retrieved-shipment
        (unwrap!
          (get-shipment-optional shipment-id)
          ERR_SHIPMENT_NOT_FOUND
        )
      )
    )
    ;; Verify the location is correct.
    (asserts!
      (is-eq (get location retrieved-shipment) starting-location)
      ERR_ASSERTION_FAILED
    )
    (ok true)
  )
)
