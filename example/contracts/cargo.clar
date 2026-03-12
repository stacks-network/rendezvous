;; This is a simple decentralized shipment tracker contract. Originally copied
;; from https://github.com/kenrogers/cargo/. In its first implementation, the
;; contract had a bug that didn't update the last-shipment-id variable when
;; creating a new shipment. This bug is fixed in the current implementation.

(define-constant err-shipment-not-found (err u100))
(define-constant err-tx-sender-unauthorized (err u101))

(define-data-var last-shipment-id uint u0)
(define-map shipments uint {
  location: (string-ascii 25), 
  status: (string-ascii 25), 
  shipper: principal, 
  receiver: principal
})

(define-public (create-new-shipment (starting-location (string-ascii 25)) 
                                    (receiver principal))
  (let 
    (
      (new-shipment-id (+ (var-get last-shipment-id) u1))
    )
    ;; #[filter(starting-location, receiver)]
    (map-set shipments new-shipment-id {
      location: starting-location,
      status: "In Transit",
      shipper: tx-sender,
      receiver: receiver
    })

    ;; The following line fixes the bug in the original implementation.
    ;; Comment out this line to re-introduce the bug.
    (var-set last-shipment-id new-shipment-id)
    (ok "Shipment created successfully")
  )
)

(define-public (update-shipment (shipment-id uint) 
                                (current-location (string-ascii 25)))
  (let
    (
      (previous-shipment (unwrap!
                            (map-get? shipments shipment-id)
                            err-shipment-not-found))
      (shipper (get shipper previous-shipment))
      (new-shipment-info (merge
                            previous-shipment
                            {location: current-location}))
    )
    (asserts! (is-eq tx-sender shipper) err-tx-sender-unauthorized)
    ;; #[filter(shipment-id)]
    (map-set shipments shipment-id new-shipment-info)
    (ok "Shipment updated successfully")
  )
)

(define-read-only (get-shipment (shipment-id uint))
  (unwrap! (map-get? shipments shipment-id) {status: "Does not exist"})
)

;; This function retrieves shipment information in an optional format. It was
;; added because the original `get-shipment` function returns a default tuple
;; if the shipment is not found, making it difficult to verify a missing
;; shipment in test cases.
(define-read-only (get-shipment-optional (shipment-id uint))
  (map-get? shipments shipment-id)
)

(define-read-only (get-last-shipment-id)
  (var-get last-shipment-id)
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

;; Invariants

;; #[env(simnet)]
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

;; #[env(simnet)]
(define-constant ERR_ASSERTION_FAILED (err 1))
;; #[env(simnet)]
(define-constant ERR_CONTRACT_CALL_FAILED (err 2))
;; #[env(simnet)]
(define-constant ERR_SHIPMENT_NOT_FOUND (err 3))

;; #[env(simnet)]
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

;; #[env(simnet)]
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

;; #[env(simnet)]
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

;; #[env(simnet)]
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
