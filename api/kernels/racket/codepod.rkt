(require racket/enter
         rackunit
         racket/string
         racket/list
         racket/port
         racket/format)

;; (enter! #f)

(compile-enforce-module-constants #f)

(define (ns->submod ns)
  (let ([names (string-split ns "/")])
    (when (not (empty? names))
      (let ([one (string->symbol (first names))]
            [two (map string->symbol (rest names))])
        `(submod ',one
                 ,@two)))))

(define (ns->enter ns)
  (let ([mod (ns->submod ns)])
    (if  (void? mod) '(void)
         `(dynamic-enter! ',mod))))

;; (ns->enter "hello/world/aaa")
;; => '(dynamic-enter! '(submod 'hello world aaa))

(define (ns->ensure-module ns)
  (let loop ([names (string-split ns "/")])
    (if (empty? names) '(void)
        `(module ,(string->symbol (first names)) racket/base
           ,(loop (rest names))))))
;; (ns->ensure-module "hello/world/aaa")
;; (ns->ensure-module "")

(define (CODEPOD-ADD-IMPORT from to name)
  (let ([name (string->symbol name)])
    ;; this must not be in a begin form together with (define ...)s
    (eval (ns->enter to))
    ;; FIXME I cannot require it here, otherwise this file is not loaded
    ;; (eval (require rackunit))
    (eval `(define ,name (dynamic-require/expose ',(ns->submod from) ',name)))
    ;; if no return expression, iracket will not send anything back
    "OK"))

(define (CODEPOD-DELETE-IMPORT ns name)
  (eval (ns->enter ns))
  (namespace-undefine-variable! (string->symbol name))
  "OK")

(define (string->sexp s)
  (call-with-input-string
   s
   (λ (in)
     (read in))))

(define (CODEPOD-EVAL code ns)
  ;; this is required, otherwise ns->ensure-module is not executed correctly
  ;;
  ;; I'm removing this because if the #f is not entered, CODEPOD-XXX functions
  ;; would be undefined. I will call (enter! #f) before CODEPOD-XXX
  ;;
  ;; (enter! #f)
  (eval (ns->ensure-module ns))
  (eval (ns->enter ns))
  (begin0
      (eval (string->sexp
             ;; support multiple s-exps in code
             (~a "(begin " code ")")))
    (enter! #f)))

