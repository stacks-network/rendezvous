;; Properties

(define-constant ERR_CONTRACT_CALL_FAILED (err 0))
(define-constant ERR_ASSERTION_FAILED_1 (err 1))
(define-constant ERR_ASSERTION_FAILED_2 (err 2))
(define-constant ERR_ASSERTION_FAILED_3 (err 3))

;; Some tests, like 'test-slice-list-int', are valid only for specific inputs.
;; Rendezvous generates a wide range of inputs, which may include values that
;; are unsuitable for those tests.
;; To skip the test when inputs are invalid, the first way is to define a
;; 'discard' function:
;; - Must be read-only.
;; - Name should match the property test function's, prefixed with "can-".
;; - Parameters should mirror those of the property test.
;; - Returns true only if inputs are valid, allowing the test to run.
(define-read-only (can-test-slice-list-int
    (seq (list 127 int))
    (skip int)
    (n int)
  )
  (and
    (and (<= 0 n) (<= n 127))
    (and (<= 0 skip) (<= skip 127))
  )
)

(define-public (test-slice-list-int (seq (list 127 int)) (skip int) (n int))
  (let
    ((result (slice seq skip n)))
    (if
      ;; Case 1: If skip > length of seq, result should be an empty list.
      (> (to-uint skip) (len seq))
      (asserts! (is-eq result (list )) ERR_ASSERTION_FAILED_1)
      (if
        ;; Case 2: If n > length of seq - skip, result length should be
        ;; length of seq - skip.
        (> (to-uint n) (- (len seq) (to-uint skip)))
        (asserts!
          (is-eq (len result) (- (len seq) (to-uint skip)))
          ERR_ASSERTION_FAILED_2
        )
        ;; Case 3: If n <= length of seq - skip, result length should be n.
        (asserts! (is-eq (len result) (to-uint n)) ERR_ASSERTION_FAILED_3)
      )
    )
    (ok true)
  )
)

;; Same as 'test-slice-list-int', this test is valid only for specific
;; inputs. The second way to skip the test when inputs are invalid is the
;; in-place 'discard' mechanism. A test is considered discarded when the test
;; function call returns `(ok false)`.
(define-public (test-slice-list-uint (seq (list 127 uint)) (skip int) (n int))
  (if
    ;; Discard the test if the input is invalid by returning `(ok false)`.
    (or
      (not (and (<= 0 n) (<= n 127)))
      (not (and (<= 0 skip) (<= skip 127)))
    )
    (ok false)
    (let
      ((result (slice-uint seq skip n)))
      (if
        ;; Case 1: If skip > length of seq, result should be an empty list.
        (> (to-uint skip) (len seq))
        (asserts! (is-eq result (list )) ERR_ASSERTION_FAILED_1)
        (if
          ;; Case 2: If n > length of seq - skip, result length should be
          ;; length of seq - skip.
          (> (to-uint n) (- (len seq) (to-uint skip)))
          (asserts!
            (is-eq (len result) (- (len seq) (to-uint skip)))
            ERR_ASSERTION_FAILED_2
          )
          ;; Case 3: If n <= length of seq - skip, result length should be n.
          (asserts! (is-eq (len result) (to-uint n)) ERR_ASSERTION_FAILED_3)
        )
      )
      (ok true)
    )
  )
)

(define-public (test-slice-list-bool (seq (list 127 bool)) (skip int) (n int))
  (if
    ;; Discard the test if the input is invalid.
    (or
      (not (and (<= 0 n) (<= n 127)))
      (not (and (<= 0 skip) (<= skip 127)))
    )
    (ok false)
    (let
      ((result (slice-bool seq skip n)))
      (if
        ;; Case 1: If skip > length of seq, result should be an empty list.
        (> (to-uint skip) (len seq))
        (asserts! (is-eq result (list )) ERR_ASSERTION_FAILED_1)
        (if
          ;; Case 2: If n > length of seq - skip, result length should be
          ;; length of seq - skip.
          (> (to-uint n) (- (len seq) (to-uint skip)))
          (asserts!
            (is-eq (len result) (- (len seq) (to-uint skip)))
            ERR_ASSERTION_FAILED_2
          )
          ;; Case 3: If n <= length of seq - skip, result length should be n.
          (asserts! (is-eq (len result) (to-uint n)) ERR_ASSERTION_FAILED_3)
        )
      )
      (ok true)
    )
  )
)

(define-public (test-slice-buff (seq (buff 127)) (skip int) (n int))
  (if
    ;; Discard the test if the input is invalid.
    (or
      (not (and (<= 0 n) (<= n 127)))
      (not (and (<= 0 skip) (<= skip 127)))
    )
    (ok false)
    (let
      ((result (slice-buff seq skip n)))
      (if
        ;; Case 1: If skip > length of seq, result should be an empty list.
        (> (to-uint skip) (len seq))
        (asserts! (is-eq result 0x) ERR_ASSERTION_FAILED_1)
        (if
          ;; Case 2: If n > length of seq - skip, result length should be
          ;; length of seq - skip.
          (> (to-uint n) (- (len seq) (to-uint skip)))
          (asserts!
            (is-eq (len result) (- (len seq) (to-uint skip)))
            ERR_ASSERTION_FAILED_2
          )
          ;; Case 3: If n <= length of seq - skip, result length should be n.
          (asserts! (is-eq (len result) (to-uint n)) ERR_ASSERTION_FAILED_3)
        )
      )
      (ok true)
    )
  )
)

(define-public (test-slice-string (seq (string-utf8 127)) (skip int) (n int))
  (if
    ;; Discard the test if the input is invalid.
    (or
      (not (and (<= 0 n) (<= n 127)))
      (not (and (<= 0 skip) (<= skip 127)))
    )
    (ok false)
    (let
      ((result (slice-string seq skip n)))
      (if
        ;; Case 1: If skip > length of seq, result should be an empty string.
        (> (to-uint skip) (len seq))
        (asserts! (is-eq result u"") ERR_ASSERTION_FAILED_1)
        (if
          ;; Case 2: If n > length of seq - skip, result length should be
          ;; length of seq - skip.
          (> (to-uint n) (- (len seq) (to-uint skip)))
          (asserts!
            (is-eq (len result) (- (len seq) (to-uint skip)))
            ERR_ASSERTION_FAILED_2
          )
          ;; Case 3: If n <= length of seq - skip, result length should be n.
          (asserts! (is-eq (len result) (to-uint n)) ERR_ASSERTION_FAILED_3)
        )
      )
      (ok true)
    )
  )
)

(define-public (test-slice-ascii (seq (string-ascii 127)) (skip int) (n int))
  (if
    ;; Discard the test if the input is invalid.
    (or
      (not (and (<= 0 n) (<= n 127)))
      (not (and (<= 0 skip) (<= skip 127)))
    )
    (ok false)
    (let
      ((result (slice-ascii seq skip n)))
      (if
        ;; Case 1: If skip > length of seq, result should be an empty string.
        (> (to-uint skip) (len seq))
        (asserts! (is-eq result "") ERR_ASSERTION_FAILED_1)
        (if
          ;; Case 2: If n > length of seq - skip, result length should be
          ;; length of seq - skip.
          (> (to-uint n) (- (len seq) (to-uint skip)))
          (asserts!
            (is-eq (len result) (- (len seq) (to-uint skip)))
            ERR_ASSERTION_FAILED_2
          )
          ;; Case 3: If n <= length of seq - skip, result length should be n.
          (asserts! (is-eq (len result) (to-uint n)) ERR_ASSERTION_FAILED_3)
        )
      )
      (ok true)
    )
  )
)