-- Rollback for 20260525215000_add_restaurant_memory_rules.sql

BEGIN;

DROP TABLE IF EXISTS public.restaurant_memory_rules;

COMMIT;
