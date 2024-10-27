;; cargo
;; a simple decentralized shipment tracker

;; constants
(define-constant err-shipment-not-found (err u100))
(define-constant err-tx-sender-unauthorized (err u101))

;; data maps and vars
(define-data-var last-shipment-id uint u0)
(define-map shipments uint {location: (string-ascii 25), status: (string-ascii 25), shipper: principal, receiver: principal})

;; private functions
;;

;; public functions
(define-public (create-new-shipment (starting-location (string-ascii 25)) (receiver principal))
    (let
        (
            (new-shipment-id (+ (var-get last-shipment-id) u1))
        )
        ;; #[filter(starting-location, receiver)]
        (map-set shipments new-shipment-id {location: starting-location, status: "In Transit", shipper: tx-sender, receiver: receiver})
        ;; The following line fixes the bug in the original code.
        ;; (var-set last-shipment-id new-shipment-id)
        (ok "Shipment created successfully")
    )
)

(define-public (update-shipment (shipment-id uint) (current-location (string-ascii 25)))
    (let
        (
            (previous-shipment (unwrap! (map-get? shipments shipment-id) err-shipment-not-found))
            (shipper (get shipper previous-shipment))
            (new-shipment-info (merge previous-shipment {location: current-location}))
        )
        (asserts! (is-eq tx-sender shipper) err-tx-sender-unauthorized)
        ;; #[filter(shipment-id)]
        (map-set shipments shipment-id new-shipment-info)
        (ok "Shipment updated successfully")
    )
)

;; read only functions
(define-read-only (get-shipment (shipment-id uint))
    (unwrap! (map-get? shipments shipment-id) {status: "Does not exist"})
)

(define-read-only (get-last-shipment-id)
    (var-get last-shipment-id)
)
