;; This reverses a list of integers, unsigned integers, buffers, and strings.
;; Originally copied from https://github.com/PromptECO/clarity-sequence/blob/
;; 6552b9a89d6d6983cdf5fef85b19f35eca299ee0/contracts/reverse/reverse7.clar.

(define-constant max-len (- (pow 2 7) 1))

(define-private (reverse-redx-integer-list
                 (item int)
                 (seq (list 127 int)))
 (unwrap-panic
  (as-max-len?
   (concat (list item) seq)
   u127)))

(define-private (reverse-list
                 (seq (list 127 int)))
 (fold reverse-redx-integer-list seq (list)))

(define-read-only (reverse (seq (list 127 int)))
 (reverse-list seq))

(define-private (reverse-redx-unsigned-list
                 (item uint)
                 (seq (list 127 uint)))
 (unwrap-panic
  (as-max-len?
   (concat (list item) seq)
   u127))) ;; Replace with u4 to introduce a bug.

(define-private (reverse-list1
                 (seq (list 127 uint)))
 (fold reverse-redx-unsigned-list seq (list)))

(define-read-only (reverse-uint (seq (list 127 uint)))
 (reverse-list1 seq))

(define-private (reverse-redx-buffer-buffer
                 (item (buff 1))
                 (seq (buff 127)))
 (unwrap-panic
  (as-max-len?
   (concat item seq)
   u127)))

(define-private (reverse-buffer
                 (seq (buff 127)))
 (fold reverse-redx-buffer-buffer seq 0x))

(define-read-only (reverse-buff (seq (buff 127)))
 (reverse-buffer seq))

(define-private (reverse-redx-string-string
                 (item (string-utf8 1))
                 (seq (string-utf8 127)))
 (unwrap-panic
  (as-max-len?
   (concat item seq)
   u127)))

(define-private (reverse-string1
                 (seq (string-utf8 127)))
 (fold reverse-redx-string-string seq u""))

(define-read-only (reverse-string (seq (string-utf8 127)))
 (reverse-string1 seq))

(define-private (reverse-redx-string-string1
                 (item (string-ascii 1))
                 (seq (string-ascii 127)))
 (unwrap-panic
  (as-max-len?
   (concat item seq)
   u127)))

(define-private (reverse-string2
                 (seq (string-ascii 127)))
 (fold reverse-redx-string-string1 seq ""))

(define-read-only (reverse-ascii (seq (string-ascii 127)))
 (reverse-string2 seq))
