(define-constant ERR_ASSERTION_FAILED (err 1))

(define-public (test-reverse (seq (list 127 int)))
  (begin
    (asserts!
      (is-eq seq
        (contract-call? .reverse reverse
          (contract-call? .reverse reverse seq)))
      ERR_ASSERTION_FAILED)
    (ok true)))

(define-public (test-reverse-uint (seq (list 127 uint)))
  (begin
    (asserts!
      (is-eq seq
        (contract-call? .reverse reverse-uint
          (contract-call? .reverse reverse-uint seq)))
      ERR_ASSERTION_FAILED)
    (ok true)))

(define-public (test-reverse-buff (seq (buff 127)))
  (begin
    (asserts!
      (is-eq seq
        (contract-call? .reverse reverse-buff
          (contract-call? .reverse reverse-buff seq)))
      ERR_ASSERTION_FAILED)
    (ok true)))

(define-public (test-reverse-string (seq (string-utf8 127)))
  (begin
    (asserts!
      (is-eq seq
        (contract-call? .reverse reverse-string
          (contract-call? .reverse reverse-string seq)))
      ERR_ASSERTION_FAILED)
    (ok true)))

(define-public (test-reverse-ascii (seq (string-ascii 127)))
  (begin
    (asserts!
      (is-eq seq
        (contract-call? .reverse reverse-ascii
          (contract-call? .reverse reverse-ascii seq)))
      ERR_ASSERTION_FAILED)
    (ok true)))
