;; This test catches the bug in the counter contract.
(define-public (test-increment)
  (let ((counter-before (get-counter)))
    (unwrap-panic (increment))
    (asserts! (is-eq (get-counter) (+ counter-before u1)) (err u404))
    (ok true)))

;; Test that takes a parameter. This will be run using property-based techniques.
(define-public (test-add (n uint))
  (let ((counter-before (get-counter)))
    (ok 
      (if 
        (> n u1)
        (begin
          (try! (add n))
          (asserts! (is-eq (get-counter) (+ counter-before n)) (err u403))
          true)
        true))))