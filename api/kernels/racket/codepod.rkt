(module CODEPOD racket

(require (for-syntax syntax/parse racket rackunit)
         racket/enter
         rackunit
         racket/string
         racket/list
         racket/port
         racket/format
         uuid)

(provide
  my-ns-enter!
  CODEPOD-ADD-IMPORT
  CODEPOD-ADD-IMPORT-NS
  CODEPOD-DELETE-IMPORT
  CODEPOD-EVAL
  CODEPOD-link)

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

;; FIXME this will declare new modules every time. Instead, I should go into the module and declare a submodule
(define (ns->ensure-module ns)
  (let loop ([names (string-split ns "/")])
    (if (empty? names) '(void)
        `(module ,(string->symbol (first names)) racket/base
           ,(loop (rest names))))))
;; (ns->ensure-module "hello/world/aaa")
;; (ns->ensure-module "")

;; FIXME not working, but the expanded code works, weird
(define-syntax (reset-module stx)
  (syntax-parse
    stx
    [(_ ns names ...)
    #`(module ns racket
        (require rackunit 'CODEPOD)
        (provide names ...)
        (define names "PLACEHOLDER") ...)]))

(define (my-ns-enter! ns)
  (with-handlers 
    ([exn:fail:contract? 
      (lambda (exn)
        (eval 
          `(module ,(string->symbol ns) racket/base
             ;; some basic packages
             (require rackunit 'CODEPOD)
             (void)))
        (eval 
          `(enter! (submod ',(string->symbol ns))))
        "OK2")])
    (eval 
      `(enter! (submod ',(string->symbol ns))))
    "OK1"))

(define (CODEPOD-ADD-IMPORT from to name)
  (let ([name (string->symbol name)])
    ;; this must not be in a begin form together with (define ...)s
    ; (eval (ns->enter to))
    (my-ns-enter! to)
    ;; FIXME I cannot require it here, otherwise this file is not loaded
    ;; (eval (require rackunit))

    ;; OPTION 1: will not update if the def changes!
    ; (eval `(define ,name (dynamic-require/expose '',(string->symbol from) ',name)))
    ;; OPTION 2: will update, but not work on macros
    ; (eval `(require/expose ',(string->symbol from) (,name)))
    ;; OPTION 3: seems to work, but only for provided names
    ;; UDPATE seems not updating either
    (eval `(require ',(string->symbol from)))
    ;; if no return expression, iracket will not send anything back
    "OK"))

(define (CODEPOD-ADD-IMPORT-NS to nses)
  (my-ns-enter! to)
  (for ([ns (string-split nses)])
    (eval `(require ',(string->symbol ns))))
  "OK")

(define (CODEPOD-DELETE-IMPORT ns name)
  ; (eval (ns->enter ns))
  (my-ns-enter! ns)
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
  ; (eval (ns->ensure-module ns))
  ; (eval (ns->enter ns))
  (my-ns-enter! ns)
  (begin0
      (eval (string->sexp
             ;; support multiple s-exps in code
             (~a "(begin " code ")")))
    (enter! #f)))


(define (CODEPOD-link src)
  (let-values ([(_ fname __) (split-path src)])
    (let* ([id (uuid-string)]
           [dir (build-path "/mount/shared/static/" id)]
           [dst (build-path dir fname)]
           [url (build-path 
                  ; "http://api.codepod.test:4000/static/" 
                  id fname)])
      (make-directory* dir)
      (copy-file src dst)
      (~a "CODEPOD-link " (path->string url)))))

)