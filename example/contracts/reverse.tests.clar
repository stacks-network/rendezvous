;; Properties

(define-constant ERR_ASSERTION_FAILED (err 1))

(define-public (test-reverse (seq (list 127 int)))
  (begin
    (asserts!
      (is-eq seq
        (reverse
          (reverse seq)))
      ERR_ASSERTION_FAILED)
    (ok true)))

(define-public (test-reverse-uint (seq (list 127 uint)))
  (begin
    (asserts!
      (is-eq seq
        (reverse-uint
          (reverse-uint seq)))
      ERR_ASSERTION_FAILED)
    (ok true)))

(define-public (test-reverse-buff (seq (buff 127)))
  (begin
    (asserts!
      (is-eq seq
        (reverse-buff
          (reverse-buff seq)))
      ERR_ASSERTION_FAILED)
    (ok true)))

(define-public (test-reverse-string (seq (string-utf8 127)))
  (begin
    (asserts!
      (is-eq seq
        (reverse-string
          (reverse-string seq)))
      ERR_ASSERTION_FAILED)
    (ok true)))

(define-public (test-reverse-ascii (seq (string-ascii 127)))
  (begin
    (asserts!
      (is-eq seq
        (reverse-ascii
          (reverse-ascii seq)))
      ERR_ASSERTION_FAILED)
    (ok true)))
