-- 5.1.3 fix cycle 2: add unsubscribe_token to customers
-- The campaign-email-worker reads customers.unsubscribe_token to build the
-- RFC 8058 one-click List-Unsubscribe URL embedded in every marketing email.
-- Baseline schema does not include the column.
-- Token is a per-customer UUID v4 -- unguessable, safe to expose in URLs.

BEGIN;

ALTER TABLE public.customers
  ADD COLUMN unsubscribe_token uuid DEFAULT gen_random_uuid() NOT NULL;

CREATE UNIQUE INDEX customers_unsubscribe_token_unique
  ON public.customers(unsubscribe_token);

COMMIT;
