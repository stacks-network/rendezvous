(define-constant ERR_CONTRACT_CALL_FAILED (err 0))
(define-constant ERR_ASSERTION_FAILED_1 (err 1))
(define-constant ERR_ASSERTION_FAILED_2 (err 2))
(define-constant ERR_ASSERTION_FAILED_3 (err 3))

(define-public (test-slice-list-int (seq (list 127 int)) (skip int) (n int))
  (if
    ;; Early return if the preliminary function returns false.
    (not (can-test-slice-list-int seq skip n))
    (ok true)
    (let (
        (result (contract-call? .slice slice seq skip n))
      )
      (if
        ;; Case 1: If skip > length of seq, result should be an empty list.
        (> (to-uint skip) (len seq))
        (asserts! (is-eq result (list )) ERR_ASSERTION_FAILED_1)
        (if
          ;; Case 2: If n > length of seq - skip, result length should be
          ;; length of seq - skip.
          (>
            (to-uint n)
            (- (len seq) (to-uint skip)))
          (asserts!
            (is-eq
              (len result)
              (- (len seq) (to-uint skip)))
            ERR_ASSERTION_FAILED_2)
          ;; Case 3: If n <= length of seq - skip, result length should be n.
          (asserts! (is-eq (len result) (to-uint n)) ERR_ASSERTION_FAILED_3)))
      (ok true))))

;; If a property test is conditional (https://www.cse.chalmers.se/~rjmh/
;; QuickCheck/manual_body.html#6), it requires a preliminary function to check
;; the input validity before running the test.
;; 
;; The preliminary function must follow these rules:
;; - It must have read-only access.
;; - Its name should match the property test function's name, prefixed with
;;   "can-".
;; - Its parameters should mirror those of the property test function.
;; - It must return a boolean indicating whether the inputs are valid.
;; 
;; Rendezvous will first call the preliminary function; if it returns false, a
;; warning will be logged. In the future, with config file support, users will
;; be able to customize generated argument values based on the preliminary
;; function's result.
(define-read-only (can-test-slice-list-int (seq (list 127 int))
                                                   (skip int)
                                                   (n int))
  (and
    (and (<= 0 n) (<= n 127))
    (and (<= 0 skip) (<= skip 127))))

(define-public (test-slice-list-uint (seq (list 127 uint)) (skip int) (n int))
  (if
    ;; Early return if the input is invalid.
    (or
      (not (and (<= 0 n) (<= n 127)))
      (not (and (<= 0 skip) (<= skip 127))))
    (ok true)
    (let (
        (result (contract-call? .slice slice-uint seq skip n))
      )
      (if
        ;; Case 1: If skip > length of seq, result should be an empty list.
        (> (to-uint skip) (len seq))
        (asserts! (is-eq result (list )) ERR_ASSERTION_FAILED_1)
        (if
          ;; Case 2: If n > length of seq - skip, result length should be
          ;; length of seq - skip.
          (>
            (to-uint n)
            (- (len seq) (to-uint skip)))
          (asserts!
            (is-eq
              (len result)
              (- (len seq) (to-uint skip)))
            ERR_ASSERTION_FAILED_2)
          ;; Case 3: If n <= length of seq - skip, result length should be n.
          (asserts! (is-eq (len result) (to-uint n)) ERR_ASSERTION_FAILED_3)))
      (ok true))))

(define-public (test-slice-list-bool (seq (list 127 bool)) (skip int) (n int))
  (if
    ;; Early return if the input is invalid.
    (or
      (not (and (<= 0 n) (<= n 127)))
      (not (and (<= 0 skip) (<= skip 127))))
    (ok true)
    (let (
        (result (contract-call? .slice slice-bool seq skip n))
      )
      (if
        ;; Case 1: If skip > length of seq, result should be an empty list.
        (> (to-uint skip) (len seq))
        (asserts! (is-eq result (list )) ERR_ASSERTION_FAILED_1)
        (if
          ;; Case 2: If n > length of seq - skip, result length should be
          ;; length of seq - skip.
          (>
            (to-uint n)
            (- (len seq) (to-uint skip)))
          (asserts!
            (is-eq
              (len result)
              (- (len seq) (to-uint skip)))
            ERR_ASSERTION_FAILED_2)
          ;; Case 3: If n <= length of seq - skip, result length should be n.
          (asserts! (is-eq (len result) (to-uint n)) ERR_ASSERTION_FAILED_3)))
      (ok true))))

(define-public (test-slice-buff (seq (buff 127)) (skip int) (n int))
  (if
    ;; Early return if the input is invalid.
    (or
      (not (and (<= 0 n) (<= n 127)))
      (not (and (<= 0 skip) (<= skip 127))))
    (ok true)
    (let (
        (result (contract-call? .slice slice-buff seq skip n))
      )
      (if
        ;; Case 1: If skip > length of seq, result should be an empty list.
        (> (to-uint skip) (len seq))
        (asserts! (is-eq result 0x) ERR_ASSERTION_FAILED_1)
        (if
          ;; Case 2: If n > length of seq - skip, result length should be
          ;; length of seq - skip.
          (>
            (to-uint n)
            (- (len seq) (to-uint skip)))
          (asserts!
            (is-eq
              (len result)
              (- (len seq) (to-uint skip)))
            ERR_ASSERTION_FAILED_2)
          ;; Case 3: If n <= length of seq - skip, result length should be n.
          (asserts! (is-eq (len result) (to-uint n)) ERR_ASSERTION_FAILED_3)))
      (ok true))))

(define-public (test-slice-string (seq (string-utf8 127)) (skip int) (n int))
  (if
    ;; Early return if the input is invalid.
    (or
      (not (and (<= 0 n) (<= n 127)))
      (not (and (<= 0 skip) (<= skip 127))))
    (ok true)
    (let (
        (result (contract-call? .slice slice-string seq skip n))
      )
      (if
        ;; Case 1: If skip > length of seq, result should be an empty string.
        (> (to-uint skip) (len seq))
        (asserts! (is-eq result u"") ERR_ASSERTION_FAILED_1)
        (if
          ;; Case 2: If n > length of seq - skip, result length should be
          ;; length of seq - skip.
          (> (to-uint n) (- (len seq) (to-uint skip)))
          (asserts!
            (is-eq
              (len result)
              (- (len seq) (to-uint skip)))
            ERR_ASSERTION_FAILED_2)
          ;; Case 3: If n <= length of seq - skip, result length should be n.
          (asserts! (is-eq (len result) (to-uint n)) ERR_ASSERTION_FAILED_3)))
      (ok true))))

(define-public (test-slice-ascii (seq (string-ascii 127)) (skip int) (n int))
  (if
    ;; Early return if the input is invalid.
    (or
      (not (and (<= 0 n) (<= n 127)))
      (not (and (<= 0 skip) (<= skip 127))))
    (ok true)
    (let (
        (result (contract-call? .slice slice-ascii seq skip n))
      )
      (if
        ;; Case 1: If skip > length of seq, result should be an empty string.
        (> (to-uint skip) (len seq))
        (asserts! (is-eq result "") ERR_ASSERTION_FAILED_1)
        (if
          ;; Case 2: If n > length of seq - skip, result length should be
          ;; length of seq - skip.
          (> (to-uint n) (- (len seq) (to-uint skip)))
          (asserts!
            (is-eq
              (len result)
              (- (len seq) (to-uint skip)))
            ERR_ASSERTION_FAILED_2)
          ;; Case 3: If n <= length of seq - skip, result length should be n.
          (asserts! (is-eq (len result) (to-uint n)) ERR_ASSERTION_FAILED_3)))
      (ok true))))