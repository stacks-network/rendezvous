(define-read-only (invariant-last-shipment-id-gt-0-after-create-shipment)
  (let 
    (
      (create-shipment-num-calls
        (default-to u0 (get called (map-get? context "create-new-shipment"))))
    )
    (if (> create-shipment-num-calls u0)
        (> (var-get last-shipment-id) u0)
        true)))
