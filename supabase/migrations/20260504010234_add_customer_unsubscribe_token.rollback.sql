-- Rollback for 20260504010234_add_customer_unsubscribe_token.sql
BEGIN;
DROP INDEX IF EXISTS customers_unsubscribe_token_unique;
ALTER TABLE public.customers DROP COLUMN IF EXISTS unsubscribe_token;
COMMIT;
