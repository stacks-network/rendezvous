(define-public (test-reverse-list (seq (list 127 uint)))
  (begin
    (asserts!
      (is-eq seq
        (contract-call? .reverse reverse-uint
          (contract-call? .reverse reverse-uint seq)))
      (err u999))
    (ok true)))
