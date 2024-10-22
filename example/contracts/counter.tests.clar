;; This test catches the bug in the counter contract.
(define-public (test-increment)
  (let ((counter-before (contract-call? .counter get-counter)))
    (unwrap-panic (contract-call? .counter increment))
    (asserts! (is-eq (contract-call? .counter get-counter) (+ counter-before u1)) (err u404))
    (ok true)))

;; Test that takes a parameter. This will be run using property-based techniques.
(define-public (test-add (n uint))
  (let ((counter-before (contract-call? .counter get-counter)))
    (ok 
      (if 
        (> n u1)
        (begin
          (try! (contract-call? .counter add n))
          (asserts! (is-eq (contract-call? .counter get-counter) (+ counter-before n)) (err u403))
          true)
        true))))