;; This slices a list of integers, unsigned integers, buffers, strings, bools.
;; Originally copied from https://github.com/PromptECO/clarity-sequence/blob/
;; 6552b9a89d6d6983cdf5fef85b19f35eca299ee0/contracts/slice/slice7.clar

(define-private (min-num-integer-integer
                 (left int)
                 (right int))
 (begin
  (assert- (and (<= 0 left) (<= left 254)) "Out of bounds: left")
  (assert- (and (<= 0 right) (<= right 127)) "Out of bounds: right")
  (if (< left right) left right)))

(define-private (asc-list
                 (d int)
                 (l (list 128 int)))
 (let ((n1 (to-int (len l))))
  (if (> n1 d)
   l
   (unwrap-panic
    (as-max-len?
     (append l
      (+ n1
       (unwrap-panic (element-at l u0))))
     u128)))))

(define-private (rep-list
                 (d int)
                 (l (list 128 int)))
 (let ((n1 (to-int (len l))))
  (if (> n1 d)
   l
   (unwrap-panic
    (as-max-len?
     (concat l l)
     u128)))))

(define-private (range-1-integer-integer
                 (lo int)
                 (hi int))
 (begin
  (assert- (and (<= 0 lo) (<= lo 127)) "Out of bounds: lo")
  (assert- (and (<= -1 hi) (<= hi 126)) "Out of bounds: hi")
  (let ((d (- hi lo)))
   (fold asc-list
    (fold rep-list (list d d d d d d d) (list d))
    (list lo)))))

(define-private (for-step-integer-list
                 (i int)
                 (seq (list 127 int)))
 (begin
  (assert- (and (<= 0 i) (<= i 126)) "Out of bounds: i")
  (unwrap-panic
   (element-at seq (to-uint i)))))

(define-private (repeat127-list
                 (x (list 127 int)))
 (list
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x))

(define-private (slice-list
                 (seq (list 127 int))
                 (skip int)
                 (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (let ((end (- (min-num-integer-integer (+ skip n)
                 (to-int (len seq)))
              1)))
   (if (>= end skip)
    (let ((i (range-1-integer-integer skip end)))
     (map for-step-integer-list i
      (repeat127-list seq)))
    (list)))))

(define-private (assert-
                 (invariant bool)
                 (message (string-ascii 64)))
 (unwrap-panic (if invariant (ok 0) (err message))))

(define-read-only (slice
                   (seq (list 127 int))
                   (skip int)
                   (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (slice-list seq skip n)))

(define-private (for-step-integer-list1
                 (i int)
                 (seq (list 127 uint)))
 (begin
  (assert- (and (<= 0 i) (<= i 126)) "Out of bounds: i")
  (unwrap-panic
   (element-at seq (to-uint i)))))

(define-private (repeat127-list1
                 (x (list 127 uint)))
 (list
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x))

(define-private (slice-list1
                 (seq (list 127 uint))
                 (skip int)
                 (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (let ((end (- (min-num-integer-integer (+ skip n)
                 (to-int (len seq)))
              1)))
   (if (>= end skip)
    (let ((i (range-1-integer-integer skip end)))
     (map for-step-integer-list1 i
      (repeat127-list1 seq)))
    (list)))))

(define-read-only (slice-uint
                   (seq (list 127 uint))
                   (skip int)
                   (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (slice-list1 seq skip n)))

(define-private (for-step-integer-list2
                 (i int)
                 (seq (list 127 bool)))
 (begin
  (assert- (and (<= 0 i) (<= i 126)) "Out of bounds: i")
  (unwrap-panic
   (element-at seq (to-uint i)))))

(define-private (repeat127-list2
                 (x (list 127 bool)))
 (list
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x))

(define-private (slice-list2
                 (seq (list 127 bool))
                 (skip int)
                 (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (let ((end (- (min-num-integer-integer (+ skip n)
                 (to-int (len seq)))
              1)))
   (if (>= end skip)
    (let ((i (range-1-integer-integer skip end)))
     (map for-step-integer-list2 i
      (repeat127-list2 seq)))
    (list)))))

(define-read-only (slice-bool
                   (seq (list 127 bool))
                   (skip int)
                   (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (slice-list2 seq skip n)))

(define-private (reducer-buffer-buffer
                 (item3 (buff 1))
                 (acc (buff 127)))
 (unwrap-panic
  (as-max-len?
   (concat acc item3)
   u127)))

(define-private (for-step-integer-buffer
                 (i int)
                 (seq (buff 127)))
 (begin
  (assert- (and (<= 0 i) (<= i 126)) "Out of bounds: i")
  (unwrap-panic
   (element-at seq (to-uint i)))))

(define-private (repeat127-buffer
                 (x (buff 127)))
 (list
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x))

(define-private (slice-buffer
                 (seq (buff 127))
                 (skip int)
                 (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (let ((end (- (min-num-integer-integer (+ skip n)
                 (to-int (len seq)))
              1)))
   (if (>= end skip)
    (let ((i (range-1-integer-integer skip end)))
     (map for-step-integer-buffer i
      (repeat127-buffer seq)))
    (list)))))

(define-private (slice-cat-buffer
                 (seq (buff 127))
                 (skip int)
                 (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (let ((init 0x))
   (fold reducer-buffer-buffer
    (slice-buffer seq skip n) init))))

(define-read-only (slice-buff
                   (seq (buff 127))
                   (skip int)
                   (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (slice-cat-buffer seq skip n)))

(define-private (reducer-1-string-string
                 (item3 (string-utf8 1))
                 (acc (string-utf8 127)))
 (unwrap-panic
  (as-max-len?
   (concat acc item3)
   u127)))

(define-private (for-step-integer-string
                 (i int)
                 (seq (string-utf8 127)))
 (begin
  (assert- (and (<= 0 i) (<= i 126)) "Out of bounds: i")
  (unwrap-panic
   (element-at seq (to-uint i)))))

(define-private (repeat127-string
                 (x (string-utf8 127)))
 (list
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x))

(define-private (slice-string1
                 (seq (string-utf8 127))
                 (skip int)
                 (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (let ((end (- (min-num-integer-integer (+ skip n)
                 (to-int (len seq)))
              1)))
   (if (>= end skip)
    (let ((i (range-1-integer-integer skip end)))
     (map for-step-integer-string i
      (repeat127-string seq)))
    (list)))))

(define-private (slice-cat-string
                 (seq (string-utf8 127))
                 (skip int)
                 (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (let ((init1 u""))
   (fold reducer-1-string-string
    (slice-string1 seq skip n) init1))))

(define-read-only (slice-string
                   (seq (string-utf8 127))
                   (skip int)
                   (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (slice-cat-string seq skip n)))

(define-private (reducer-2-string-string
                 (item3 (string-ascii 1))
                 (acc (string-ascii 127)))
 (unwrap-panic
  (as-max-len?
   (concat acc item3)
   u127)))

(define-private (for-step-integer-string1
                 (i int)
                 (seq (string-ascii 127)))
 (begin
  (assert- (and (<= 0 i) (<= i 126)) "Out of bounds: i")
  (unwrap-panic
   (element-at seq (to-uint i)))))

(define-private (repeat127-string1
                 (x (string-ascii 127)))
 (list
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x
  x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x x))

(define-private (slice-string2
                 (seq (string-ascii 127))
                 (skip int)
                 (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (let ((end (- (min-num-integer-integer (+ skip n)
                 (to-int (len seq)))
              1)))
   (if (>= end skip)
    (let ((i (range-1-integer-integer skip end)))
     (map for-step-integer-string1 i
      (repeat127-string1 seq)))
    (list)))))

(define-private (slice-cat-string1
                 (seq (string-ascii 127))
                 (skip int)
                 (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (let ((init2 ""))
   (fold reducer-2-string-string
    (slice-string2 seq skip n) init2))))

(define-read-only (slice-ascii
                   (seq (string-ascii 127))
                   (skip int)
                   (n int))
 (begin
  (assert- (and (<= 0 skip) (<= skip 127)) "Out of bounds: skip")
  (assert- (and (<= 0 n) (<= n 127)) "Out of bounds: n")
  (slice-cat-string1 seq skip n)))
