SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."cash_drawer_event_type" AS ENUM (
    'open_shift',
    'close_shift',
    'cash_sale',
    'cash_refund',
    'paid_in',
    'paid_out',
    'tip_payout',
    'no_sale',
    'count'
);


ALTER TYPE "public"."cash_drawer_event_type" OWNER TO "postgres";


CREATE TYPE "public"."comp_reason" AS ENUM (
    'manager_comp',
    'quality_issue',
    'service_issue',
    'birthday',
    'vip',
    'employee_meal',
    'promotional',
    'other'
);


ALTER TYPE "public"."comp_reason" OWNER TO "postgres";


CREATE TYPE "public"."discount_type" AS ENUM (
    'percentage',
    'fixed_amount',
    'bogo',
    'free_item'
);


ALTER TYPE "public"."discount_type" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'draft',
    'open',
    'fired',
    'ready',
    'served',
    'closed',
    'voided',
    'refunded'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."order_type" AS ENUM (
    'dine_in',
    'takeout',
    'delivery',
    'bar',
    'catering',
    'online',
    'kiosk',
    'drive_thru'
);


ALTER TYPE "public"."order_type" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'cash',
    'credit_card',
    'debit_card',
    'gift_card',
    'house_account',
    'apple_pay',
    'google_pay',
    'external'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'authorized',
    'captured',
    'settled',
    'declined',
    'voided',
    'refunded',
    'failed'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."terminal_type" AS ENUM (
    'server_station',
    'bar',
    'host',
    'cashier',
    'kds',
    'kiosk',
    'customer_display',
    'drive_thru'
);


ALTER TYPE "public"."terminal_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'platform_admin',
    'owner',
    'admin',
    'manager',
    'server',
    'bartender',
    'host',
    'kitchen',
    'cashier',
    'driver',
    'kiosk',
    'readonly'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."void_reason" AS ENUM (
    'customer_request',
    'kitchen_error',
    'server_error',
    'wrong_item',
    'quality_issue',
    '86d',
    'duplicate',
    'other'
);


ALTER TYPE "public"."void_reason" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."next_order_number"("p_location_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_next int;
BEGIN
    -- Advisory lock based on location_id to prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtext(p_location_id::text));
    
    SELECT COALESCE(MAX(order_number), 0) + 1 INTO v_next
    FROM orders
    WHERE location_id = p_location_id
      AND opened_at::date = CURRENT_DATE;
    RETURN v_next;
END;
$$;


ALTER FUNCTION "public"."next_order_number"("p_location_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accounting_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'quickbooks'::"text" NOT NULL,
    "access_token" "text",
    "refresh_token" "text",
    "realm_id" "text",
    "token_expires_at" timestamp with time zone,
    "is_connected" boolean DEFAULT false NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."accounting_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."accounting_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "sync_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "data" "jsonb",
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."accounting_sync_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'New conversation'::"text",
    "messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text" NOT NULL,
    "details" "text" DEFAULT ''::"text",
    "metric_value" "text" DEFAULT ''::"text",
    "comparison_text" "text" DEFAULT ''::"text",
    "is_dismissed" boolean DEFAULT false NOT NULL,
    "feedback" "text",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_insights_category_check" CHECK (("category" = ANY (ARRAY['menu'::"text", 'labor'::"text", 'waste'::"text", 'sales'::"text", 'speed'::"text", 'voids'::"text", 'general'::"text"]))),
    CONSTRAINT "ai_insights_feedback_check" CHECK (("feedback" = ANY (ARRAY['helpful'::"text", 'not_helpful'::"text"]))),
    CONSTRAINT "ai_insights_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."ai_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_predictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "prediction_date" "date" NOT NULL,
    "predicted_revenue" integer,
    "predicted_covers" integer,
    "predicted_labor_hours" numeric(6,1),
    "actual_revenue" integer,
    "actual_covers" integer,
    "confidence" numeric(4,3) DEFAULT 0.5,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_predictions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "ask_enabled" boolean DEFAULT true NOT NULL,
    "insights_enabled" boolean DEFAULT true NOT NULL,
    "predict_enabled" boolean DEFAULT true NOT NULL,
    "insight_delivery" "text" DEFAULT 'dashboard'::"text" NOT NULL,
    "insight_frequency" "text" DEFAULT 'daily'::"text" NOT NULL,
    "daily_query_limit" integer DEFAULT 50 NOT NULL,
    "monthly_cost_alert_cents" integer DEFAULT 5000 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_settings_insight_delivery_check" CHECK (("insight_delivery" = ANY (ARRAY['dashboard'::"text", 'email'::"text", 'both'::"text"]))),
    CONSTRAINT "ai_settings_insight_frequency_check" CHECK (("insight_frequency" = ANY (ARRAY['daily'::"text", 'weekly'::"text"])))
);


ALTER TABLE "public"."ai_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tokens_in" integer DEFAULT 0 NOT NULL,
    "tokens_out" integer DEFAULT 0 NOT NULL,
    "estimated_cost" numeric(10,4) DEFAULT 0 NOT NULL,
    "query_type" "text" DEFAULT 'ask'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_usage_query_type_check" CHECK (("query_type" = ANY (ARRAY['ask'::"text", 'insights'::"text", 'predict'::"text", 'menu_photo'::"text"])))
);


ALTER TABLE "public"."ai_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "user_id" "uuid",
    "user_name" "text",
    "user_role" "public"."user_role",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "description" "text" NOT NULL,
    "previous_state" "jsonb",
    "new_state" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "terminal_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."break_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "time_entry_id" "uuid" NOT NULL,
    "break_type" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone,
    "duration_minutes" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."break_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_recipients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "opened_at" timestamp with time zone,
    "clicked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaign_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "campaign_type" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "subject" "text",
    "body_html" "text",
    "sms_body" "text",
    "target_segment" "jsonb" NOT NULL,
    "target_count" integer,
    "scheduled_for" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "recipients_count" integer DEFAULT 0,
    "opened_count" integer DEFAULT 0,
    "clicked_count" integer DEFAULT 0,
    "redeemed_count" integer DEFAULT 0,
    "discount_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cash_drawer_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cash_drawer_id" "uuid" NOT NULL,
    "event_type" "public"."cash_drawer_event_type" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "running_total" numeric(10,2) NOT NULL,
    "order_id" "uuid",
    "payment_id" "uuid",
    "description" "text",
    "performed_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cash_drawer_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cash_drawers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "terminal_id" "uuid",
    "name" "text" DEFAULT 'Main Drawer'::"text" NOT NULL,
    "is_open" boolean DEFAULT false NOT NULL,
    "opened_by" "uuid",
    "opened_at" timestamp with time zone,
    "starting_cash" numeric(10,2),
    "current_cash" numeric(10,2),
    "expected_cash" numeric(10,2),
    "actual_cash" numeric(10,2),
    "over_short" numeric(10,2),
    "closed_by" "uuid",
    "closed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cash_drawers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cash_tip_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "shift_date" "date" NOT NULL,
    "reported_amount" numeric(10,2) NOT NULL,
    "reported_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cash_tip_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catering_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "event_name" "text" NOT NULL,
    "event_date" "date" NOT NULL,
    "event_time" time without time zone,
    "end_time" time without time zone,
    "guest_count" integer NOT NULL,
    "venue_name" "text",
    "venue_address" "jsonb",
    "contact_name" "text" NOT NULL,
    "contact_phone" "text",
    "contact_email" "text",
    "status" "text" DEFAULT 'inquiry'::"text" NOT NULL,
    "order_id" "uuid",
    "catering_menu_id" "uuid",
    "subtotal" numeric(12,2),
    "tax_total" numeric(12,2),
    "service_charge" numeric(12,2),
    "total" numeric(12,2),
    "deposit_amount" numeric(12,2),
    "deposit_paid_at" timestamp with time zone,
    "notes" "text",
    "special_requirements" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."catering_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catering_menus" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "pricing_model" "text" DEFAULT 'per_person'::"text" NOT NULL,
    "min_guest_count" integer,
    "max_guest_count" integer,
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "base_price_per_person" numeric(10,2),
    "service_charge_percentage" numeric(5,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."catering_menus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chargebacks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "payment_id" "uuid",
    "processor_dispute_id" "text" NOT NULL,
    "reason_code" "text" NOT NULL,
    "reason_description" "text",
    "amount" numeric(10,2) NOT NULL,
    "received_at" timestamp with time zone NOT NULL,
    "respond_by" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "evidence_submitted_at" timestamp with time zone,
    "evidence" "jsonb",
    "resolved_at" timestamp with time zone,
    "resolution" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chargebacks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "label" "text" DEFAULT 'home'::"text",
    "line1" "text" NOT NULL,
    "line2" "text",
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "zip" "text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customer_addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "processor_name" "text" NOT NULL,
    "processor_customer_id" "text",
    "processor_card_token" "text" NOT NULL,
    "card_brand" "text" NOT NULL,
    "card_last_four" "text" NOT NULL,
    "exp_month" integer,
    "exp_year" integer,
    "cardholder_name" "text",
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


ALTER TABLE "public"."customer_payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "email" "text",
    "phone" "text",
    "notes" "text",
    "tags" "text"[],
    "total_visits" integer DEFAULT 0 NOT NULL,
    "total_spent" numeric(12,2) DEFAULT 0 NOT NULL,
    "average_check" numeric(10,2) DEFAULT 0 NOT NULL,
    "last_visit_at" timestamp with time zone,
    "marketing_opt_in" boolean DEFAULT false NOT NULL,
    "birthday" "date",
    "anniversary" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "total_spend" numeric DEFAULT 0,
    "is_vip" boolean DEFAULT false,
    "allergies" "text"[] DEFAULT '{}'::"text"[],
    "dietary_preferences" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_item_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "metric_date" "date" NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "quantity_sold" integer DEFAULT 0,
    "gross_revenue" numeric(10,2) DEFAULT 0,
    "food_cost" numeric(10,2) DEFAULT 0,
    "margin_percentage" numeric(5,2) DEFAULT 0
);


ALTER TABLE "public"."daily_item_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "metric_date" "date" NOT NULL,
    "total_revenue" numeric(12,2) DEFAULT 0,
    "net_revenue" numeric(12,2) DEFAULT 0,
    "order_count" integer DEFAULT 0,
    "average_check" numeric(10,2) DEFAULT 0,
    "covers" integer DEFAULT 0,
    "revenue_per_cover" numeric(10,2) DEFAULT 0,
    "dine_in_revenue" numeric(12,2) DEFAULT 0,
    "takeout_revenue" numeric(12,2) DEFAULT 0,
    "delivery_revenue" numeric(12,2) DEFAULT 0,
    "online_revenue" numeric(12,2) DEFAULT 0,
    "cash_total" numeric(12,2) DEFAULT 0,
    "card_total" numeric(12,2) DEFAULT 0,
    "gift_card_total" numeric(12,2) DEFAULT 0,
    "labor_cost" numeric(12,2) DEFAULT 0,
    "labor_hours" numeric(8,2) DEFAULT 0,
    "labor_percentage" numeric(5,2) DEFAULT 0,
    "food_cost" numeric(12,2) DEFAULT 0,
    "food_cost_percentage" numeric(5,2) DEFAULT 0,
    "discount_total" numeric(12,2) DEFAULT 0,
    "comp_total" numeric(12,2) DEFAULT 0,
    "void_total" numeric(12,2) DEFAULT 0,
    "refund_total" numeric(12,2) DEFAULT 0,
    "tip_total" numeric(12,2) DEFAULT 0,
    "avg_ticket_time_seconds" integer DEFAULT 0,
    "avg_table_turn_minutes" integer DEFAULT 0,
    "hourly_revenue" "jsonb" DEFAULT '{}'::"jsonb",
    "hourly_covers" "jsonb" DEFAULT '{}'::"jsonb",
    "calculated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."daily_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_reconciliations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "business_date" "date" NOT NULL,
    "gross_sales" numeric(12,2) NOT NULL,
    "discount_total" numeric(12,2) DEFAULT 0,
    "comp_total" numeric(12,2) DEFAULT 0,
    "net_sales" numeric(12,2) NOT NULL,
    "tax_collected" numeric(12,2) NOT NULL,
    "credit_card_total" numeric(12,2) DEFAULT 0,
    "cash_total" numeric(12,2) DEFAULT 0,
    "gift_card_total" numeric(12,2) DEFAULT 0,
    "house_account_total" numeric(12,2) DEFAULT 0,
    "visa_total" numeric(12,2) DEFAULT 0,
    "mastercard_total" numeric(12,2) DEFAULT 0,
    "amex_total" numeric(12,2) DEFAULT 0,
    "discover_total" numeric(12,2) DEFAULT 0,
    "cc_tips" numeric(12,2) DEFAULT 0,
    "cash_tips_reported" numeric(12,2) DEFAULT 0,
    "auto_gratuity_total" numeric(12,2) DEFAULT 0,
    "void_total" numeric(12,2) DEFAULT 0,
    "refund_total" numeric(12,2) DEFAULT 0,
    "surcharge_total" numeric(12,2) DEFAULT 0,
    "cash_expected" numeric(12,2) DEFAULT 0,
    "cash_counted" numeric(12,2),
    "cash_variance" numeric(12,2),
    "estimated_processing_fee" numeric(12,2) DEFAULT 0,
    "closed_by" "uuid",
    "closed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_reconciliations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "driver_id" "uuid",
    "zone_id" "uuid",
    "pickup_time" timestamp with time zone,
    "delivery_time" timestamp with time zone,
    "estimated_delivery_at" timestamp with time zone,
    "actual_delivery_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "delivery_address" "jsonb" NOT NULL,
    "delivery_instructions" "text",
    "delivery_fee" numeric(10,2) DEFAULT 0 NOT NULL,
    "driver_tip" numeric(10,2) DEFAULT 0,
    "driver_lat" numeric(10,7),
    "driver_lng" numeric(10,7),
    "last_location_at" timestamp with time zone,
    "proof_of_delivery_url" "text",
    "signature_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deliveries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_zones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "zone_polygon" "jsonb" NOT NULL,
    "delivery_fee" numeric(10,2) DEFAULT 0 NOT NULL,
    "min_order_amount" numeric(10,2),
    "estimated_minutes" integer DEFAULT 30,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."delivery_zones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."demo_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "restaurant_name" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "locations_count" integer DEFAULT 1,
    "current_pos" "text",
    "source_page" "text",
    "utm_params" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."demo_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."digital_menu_boards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "board_type" "text" NOT NULL,
    "display_layout" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "category_ids" "uuid"[],
    "rotation_interval_seconds" integer DEFAULT 15,
    "brightness_schedule" "jsonb",
    "is_active" boolean DEFAULT true NOT NULL,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."digital_menu_boards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "discount_type" "public"."discount_type" NOT NULL,
    "percentage" numeric(5,2),
    "fixed_amount" numeric(10,2),
    "applies_to" "text" DEFAULT 'order'::"text" NOT NULL,
    "category_ids" "uuid"[],
    "item_ids" "uuid"[],
    "requires_manager_approval" boolean DEFAULT false NOT NULL,
    "max_discount_amount" numeric(10,2),
    "min_order_amount" numeric(10,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "available_days" integer[],
    "available_start_time" time without time zone,
    "available_end_time" time without time zone,
    "promo_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."discounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drive_thru_cars" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "lane_id" "uuid" NOT NULL,
    "order_id" "uuid",
    "position" integer,
    "entered_at" timestamp with time zone DEFAULT "now"(),
    "order_placed_at" timestamp with time zone,
    "payment_at" timestamp with time zone,
    "pickup_at" timestamp with time zone,
    "exited_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."drive_thru_cars" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drive_thru_lanes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "number" integer NOT NULL,
    "name" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."drive_thru_lanes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drive_thru_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "lane" integer DEFAULT 1 NOT NULL,
    "vehicle_description" "text",
    "arrived_at" timestamp with time zone,
    "ordered_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "served_at" timestamp with time zone,
    "departed_at" timestamp with time zone,
    "total_seconds" integer,
    "order_seconds" integer,
    "service_seconds" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."drive_thru_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."floor_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "canvas_width" integer DEFAULT 1200 NOT NULL,
    "canvas_height" integer DEFAULT 800 NOT NULL,
    "background_image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."floor_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."franchise_royalties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "gross_sales" numeric(12,2) NOT NULL,
    "net_sales" numeric(12,2) NOT NULL,
    "royalty_rate" numeric(5,4) NOT NULL,
    "royalty_amount" numeric(12,2) NOT NULL,
    "ad_fund_rate" numeric(5,4),
    "ad_fund_amount" numeric(12,2),
    "total_due" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "paid_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."franchise_royalties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gift_card_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "gift_card_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "balance_after" numeric(10,2) NOT NULL,
    "order_id" "uuid",
    "payment_id" "uuid",
    "performed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gift_card_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gift_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "card_number" "text" NOT NULL,
    "card_number_hash" "text" NOT NULL,
    "pin_hash" "text",
    "initial_balance" numeric(10,2) NOT NULL,
    "current_balance" numeric(10,2) NOT NULL,
    "purchased_by_customer_id" "uuid",
    "purchased_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "purchase_order_id" "uuid",
    "recipient_name" "text",
    "recipient_email" "text",
    "recipient_phone" "text",
    "message" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gift_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."house_account_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "house_account_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "balance_after" numeric(12,2) NOT NULL,
    "order_id" "uuid",
    "payment_id" "uuid",
    "description" "text",
    "performed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."house_account_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."house_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "account_name" "text" NOT NULL,
    "account_number" "text" NOT NULL,
    "credit_limit" numeric(12,2) NOT NULL,
    "current_balance" numeric(12,2) DEFAULT 0 NOT NULL,
    "billing_address" "jsonb",
    "billing_email" "text",
    "billing_cycle" "text" DEFAULT 'monthly'::"text",
    "payment_terms" "text" DEFAULT 'net_30'::"text",
    "tax_exempt" boolean DEFAULT false NOT NULL,
    "tax_exempt_id" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."house_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text",
    "category" "text",
    "unit_of_measure" "text" NOT NULL,
    "par_level" numeric(10,3),
    "reorder_point" numeric(10,3),
    "current_quantity" numeric(10,3) DEFAULT 0,
    "unit_cost" numeric(10,4),
    "vendor_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "current_stock" numeric GENERATED ALWAYS AS ("current_quantity") STORED,
    "unit" "text" GENERATED ALWAYS AS ("unit_of_measure") STORED
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "quantity_change" numeric(10,3) NOT NULL,
    "quantity_after" numeric(10,3) NOT NULL,
    "unit_cost" numeric(10,4),
    "reference_id" "uuid",
    "notes" "text",
    "performed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_waste_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "inventory_item_id" "uuid" NOT NULL,
    "quantity" numeric NOT NULL,
    "reason" "text" NOT NULL,
    "notes" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "inventory_waste_log_reason_check" CHECK (("reason" = ANY (ARRAY['expired'::"text", 'dropped'::"text", 'returned'::"text", 'overproduction'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."inventory_waste_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kds_stations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "station_type" "text" NOT NULL,
    "prep_stations" "text"[],
    "terminal_id" "uuid",
    "display_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kds_stations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kds_ticket_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "station_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "order_item_id" "uuid",
    "event_type" "text" NOT NULL,
    "performed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kds_ticket_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "address_line1" "text",
    "address_line2" "text",
    "city" "text",
    "state" "text",
    "zip" "text",
    "country" "text" DEFAULT 'US'::"text",
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "phone" "text",
    "email" "text",
    "timezone" "text" DEFAULT 'America/New_York'::"text" NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "business_hours" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "program_id" "uuid" NOT NULL,
    "points_balance" integer DEFAULT 0 NOT NULL,
    "lifetime_points" integer DEFAULT 0 NOT NULL,
    "tier" "text" DEFAULT 'bronze'::"text",
    "enrolled_at" timestamp with time zone DEFAULT "now"(),
    "last_activity_at" timestamp with time zone
);


ALTER TABLE "public"."loyalty_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "program_type" "text" NOT NULL,
    "points_per_dollar" numeric(6,2) DEFAULT 1,
    "points_per_visit" integer DEFAULT 0,
    "redemption_threshold" integer,
    "reward_value" numeric(10,2),
    "is_active" boolean DEFAULT true,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."loyalty_programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "loyalty_account_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "points" integer NOT NULL,
    "balance_after" integer NOT NULL,
    "order_id" "uuid",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."loyalty_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "available_start_time" time without time zone,
    "available_end_time" time without time zone,
    "available_days" integer[] DEFAULT '{0,1,2,3,4,5,6}'::integer[],
    "color" "text",
    "image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."menu_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_item_modifier_groups" (
    "menu_item_id" "uuid" NOT NULL,
    "modifier_group_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."menu_item_modifier_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "name" "text" NOT NULL,
    "short_name" "text",
    "description" "text",
    "price" numeric(10,2) NOT NULL,
    "cost" numeric(10,2),
    "tax_rate_id" "uuid",
    "is_taxable" boolean DEFAULT true NOT NULL,
    "prep_station" "text",
    "prep_time_minutes" integer,
    "course" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_86d" boolean DEFAULT false NOT NULL,
    "available_start_time" time without time zone,
    "available_end_time" time without time zone,
    "available_days" integer[] DEFAULT '{0,1,2,3,4,5,6}'::integer[],
    "color" "text",
    "image_url" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "nutrition" "jsonb",
    "allergens" "text"[],
    "plu_code" "text",
    "barcode" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modifier_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "min_selections" integer DEFAULT 0 NOT NULL,
    "max_selections" integer DEFAULT 1 NOT NULL,
    "is_required_prompt" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."modifier_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modifiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "modifier_group_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "short_name" "text",
    "price_adjustment" numeric(10,2) DEFAULT 0 NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."modifiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."module_migrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "module_id" "text" NOT NULL,
    "migration_name" "text" NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."module_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."online_menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "online_menu_id" "uuid" NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "is_available" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "online_price" numeric(10,2),
    "online_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."online_menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."online_menus" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."online_menus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."online_order_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "estimated_ready_minutes" integer,
    "accepted_by" "uuid",
    "accepted_at" timestamp with time zone,
    "rejected_reason" "text",
    "customer_notified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."online_order_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_discounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "discount_id" "uuid",
    "order_item_id" "uuid",
    "name" "text" NOT NULL,
    "discount_type" "public"."discount_type" NOT NULL,
    "value" numeric(10,2) NOT NULL,
    "applied_amount" numeric(10,2) NOT NULL,
    "applied_by" "uuid" NOT NULL,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_discounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_item_modifiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "modifier_id" "uuid",
    "modifier_group_id" "uuid",
    "name" "text" NOT NULL,
    "price_adjustment" numeric(10,2) DEFAULT 0 NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_item_modifiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "menu_item_id" "uuid",
    "name" "text" NOT NULL,
    "short_name" "text",
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "modifier_total" numeric(10,2) DEFAULT 0 NOT NULL,
    "discount_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "line_total" numeric(10,2) NOT NULL,
    "prep_station" "text",
    "course" integer DEFAULT 1,
    "seat_number" integer,
    "is_sent" boolean DEFAULT false NOT NULL,
    "is_fired" boolean DEFAULT false NOT NULL,
    "is_ready" boolean DEFAULT false NOT NULL,
    "is_served" boolean DEFAULT false NOT NULL,
    "is_voided" boolean DEFAULT false NOT NULL,
    "void_reason" "public"."void_reason",
    "voided_by" "uuid",
    "voided_at" timestamp with time zone,
    "is_comped" boolean DEFAULT false NOT NULL,
    "comp_reason" "public"."comp_reason",
    "comp_amount" numeric(10,2),
    "comped_by" "uuid",
    "notes" "text",
    "sent_at" timestamp with time zone,
    "fired_at" timestamp with time zone,
    "ready_at" timestamp with time zone,
    "served_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_modifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "order_item_id" "uuid",
    "modification_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "previous_value" "jsonb",
    "new_value" "jsonb",
    "performed_by" "uuid" NOT NULL,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_modifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_throttle_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "max_orders_per_15_min" integer DEFAULT 20,
    "max_orders_per_hour" integer DEFAULT 60,
    "is_paused" boolean DEFAULT false,
    "pause_reason" "text",
    "auto_accept" boolean DEFAULT true,
    "operating_hours" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_throttle_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "terminal_id" "uuid",
    "order_number" integer NOT NULL,
    "display_number" "text" NOT NULL,
    "order_type" "public"."order_type" DEFAULT 'dine_in'::"public"."order_type" NOT NULL,
    "status" "public"."order_status" DEFAULT 'draft'::"public"."order_status" NOT NULL,
    "server_id" "uuid",
    "table_id" "uuid",
    "customer_id" "uuid",
    "guest_count" integer,
    "guest_name" "text",
    "guest_phone" "text",
    "subtotal" numeric(10,2) DEFAULT 0 NOT NULL,
    "discount_total" numeric(10,2) DEFAULT 0 NOT NULL,
    "tax_total" numeric(10,2) DEFAULT 0 NOT NULL,
    "tip_total" numeric(10,2) DEFAULT 0 NOT NULL,
    "total" numeric(10,2) DEFAULT 0 NOT NULL,
    "amount_paid" numeric(10,2) DEFAULT 0 NOT NULL,
    "balance_due" numeric(10,2) DEFAULT 0 NOT NULL,
    "opened_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sent_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "scheduled_for" timestamp with time zone,
    "delivery_address" "jsonb",
    "fire_course_2_at" timestamp with time zone,
    "notes" "text",
    "source" "text" DEFAULT 'pos'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text",
    "split_from_order_id" "uuid"
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."org_modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "module_id" "text" NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "enabled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "disabled_at" timestamp with time zone,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "location_ids" "uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."org_modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "plan" "text" DEFAULT 'starter'::"text" NOT NULL,
    "subscription_status" "text" DEFAULT 'trialing'::"text" NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "logo_url" "text",
    "primary_color" "text" DEFAULT '#1a1a2e'::"text",
    "owner_name" "text",
    "owner_email" "text",
    "owner_phone" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "device_serial" "text" NOT NULL,
    "device_model" "text" NOT NULL,
    "device_label" "text",
    "connection_type" "text" NOT NULL,
    "ip_address" "text",
    "port" integer,
    "is_active" boolean DEFAULT true,
    "last_seen_at" timestamp with time zone,
    "firmware_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "payment_method" "public"."payment_method" NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "tip_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(10,2) NOT NULL,
    "processor_transaction_id" "text",
    "card_brand" "text",
    "card_last_four" "text",
    "auth_code" "text",
    "gift_card_id" "uuid",
    "cash_tendered" numeric(10,2),
    "change_due" numeric(10,2),
    "split_index" integer,
    "refund_amount" numeric(10,2),
    "refund_reason" "text",
    "refunded_by" "uuid",
    "refunded_at" timestamp with time zone,
    "original_payment_id" "uuid",
    "processed_by" "uuid" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processor_response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "location_id" "uuid"
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "module_id" "text" NOT NULL,
    "description" "text",
    "category" "text"
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_level_prices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "price_level_id" "uuid" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."price_level_prices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_level_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "price_level_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "days_of_week" integer[] NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "is_active" boolean DEFAULT true NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."price_level_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_levels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "level_number" integer NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."price_levels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."print_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "printer_id" "uuid",
    "job_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "attempts" integer DEFAULT 0,
    "max_attempts" integer DEFAULT 3,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    CONSTRAINT "print_queue_job_type_check" CHECK (("job_type" = ANY (ARRAY['receipt'::"text", 'kitchen'::"text", 'bar'::"text", 'label'::"text", 'report'::"text"]))),
    CONSTRAINT "print_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'printing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."print_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."print_routing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "category_id" "uuid",
    "printer_id" "uuid",
    "job_type" "text" DEFAULT 'kitchen'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."print_routing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."printers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "model" "text" NOT NULL,
    "connection_type" "text" NOT NULL,
    "ip_address" "text",
    "port" integer,
    "role" "text" NOT NULL,
    "station_name" "text",
    "cash_drawer_enabled" boolean DEFAULT false,
    "cash_drawer_pin" integer DEFAULT 2,
    "pulse_duration" integer DEFAULT 100,
    "is_online" boolean DEFAULT false,
    "last_heartbeat_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "printers_connection_type_check" CHECK (("connection_type" = ANY (ARRAY['network'::"text", 'cloudprnt'::"text", 'bluetooth'::"text", 'usb'::"text"]))),
    CONSTRAINT "printers_role_check" CHECK (("role" = ANY (ARRAY['receipt'::"text", 'kitchen'::"text", 'bar'::"text", 'label'::"text", 'expo'::"text"])))
);


ALTER TABLE "public"."printers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_order_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "quantity_ordered" numeric(10,3) NOT NULL,
    "quantity_received" numeric(10,3) DEFAULT 0,
    "unit_cost" numeric(10,4) NOT NULL,
    "line_total" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."purchase_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "po_number" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "total_amount" numeric(12,2),
    "ordered_at" timestamp with time zone,
    "expected_at" timestamp with time zone,
    "received_at" timestamp with time zone,
    "notes" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qr_menus" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "qr_code_url" "text",
    "menu_categories" "uuid"[],
    "allow_ordering" boolean DEFAULT false NOT NULL,
    "require_table_number" boolean DEFAULT true NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."qr_menus" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qr_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "qr_menu_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "table_id" "uuid",
    "session_id" "text" NOT NULL,
    "guest_name" "text",
    "guest_phone" "text",
    "device_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."qr_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receipt_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "header_text" "text",
    "footer_text" "text",
    "show_logo" boolean DEFAULT true,
    "show_tax_breakdown" boolean DEFAULT true,
    "show_tip_suggestions" boolean DEFAULT true,
    "tip_percentages" "jsonb" DEFAULT '[15, 18, 20, 25]'::"jsonb",
    "paper_width" integer DEFAULT 80,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."receipt_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "menu_item_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid" NOT NULL,
    "quantity_used" numeric(10,4) NOT NULL,
    "unit_of_measure" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recipes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "guest_name" "text" NOT NULL,
    "guest_phone" "text",
    "guest_email" "text",
    "party_size" integer NOT NULL,
    "reservation_date" "date" NOT NULL,
    "reservation_time" time without time zone NOT NULL,
    "duration_minutes" integer DEFAULT 90,
    "table_id" "uuid",
    "status" "text" DEFAULT 'confirmed'::"text" NOT NULL,
    "notes" "text",
    "special_requests" "text",
    "confirmation_sent_at" timestamp with time zone,
    "reminder_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role" "public"."user_role" NOT NULL,
    "permission_id" "uuid" NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."schedule_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "shift_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "notes" "text",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."scheduled_shifts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settlement_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "processor_batch_id" "text",
    "transaction_count" integer NOT NULL,
    "gross_amount" numeric(12,2) NOT NULL,
    "refund_amount" numeric(12,2) DEFAULT 0,
    "net_amount" numeric(12,2) NOT NULL,
    "batch_opened_at" timestamp with time zone,
    "batch_closed_at" timestamp with time zone NOT NULL,
    "expected_deposit_date" "date",
    "actual_deposit_date" "date",
    "actual_deposit_amount" numeric(12,2),
    "is_reconciled" boolean DEFAULT false,
    "reconciled_at" timestamp with time zone,
    "variance_amount" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."settlement_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."setup_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "current_step" integer DEFAULT 0 NOT NULL,
    "completed_steps" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."setup_progress" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shift_marketplace" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "posted_by" "uuid" NOT NULL,
    "claimed_by" "uuid",
    "reason" "text",
    "status" "text" DEFAULT 'open'::"text",
    "posted_at" timestamp with time zone DEFAULT "now"(),
    "claimed_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shift_marketplace_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'claimed'::"text", 'approved'::"text", 'denied'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."shift_marketplace" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shift_swap_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "scheduled_shift_id" "uuid" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "swap_with_user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shift_swap_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "name" "text",
    "shift_date" "date" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone,
    "manager_id" "uuid",
    "total_sales" numeric(12,2),
    "total_labor_cost" numeric(10,2),
    "total_comps" numeric(10,2),
    "total_voids" numeric(10,2),
    "is_closed" boolean DEFAULT false NOT NULL,
    "closed_by" "uuid",
    "closed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shifts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "is_available" boolean DEFAULT true NOT NULL,
    "effective_date" "date",
    "expiration_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."staff_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."surcharge_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "program_type" "text" DEFAULT 'none'::"text" NOT NULL,
    "surcharge_rate" numeric(4,2),
    "cash_discount_rate" numeric(4,2),
    "merchant_discount_rate" numeric(4,2),
    "state" "text" NOT NULL,
    "card_network_registered" boolean DEFAULT false,
    "registration_date" "date",
    "signage_confirmed" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."surcharge_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "floor_plan_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "capacity" integer DEFAULT 4 NOT NULL,
    "shape" "text" DEFAULT 'rectangle'::"text" NOT NULL,
    "pos_x" integer DEFAULT 0 NOT NULL,
    "pos_y" integer DEFAULT 0 NOT NULL,
    "width" integer DEFAULT 80 NOT NULL,
    "height" integer DEFAULT 80 NOT NULL,
    "rotation" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "current_order_id" "uuid",
    "current_server_id" "uuid",
    "seated_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "section" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "guest_count" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."tables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tax_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid",
    "name" "text" NOT NULL,
    "rate" numeric(6,4) NOT NULL,
    "is_inclusive" boolean DEFAULT false NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "applies_to" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tax_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."terminals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "terminal_type" "public"."terminal_type" NOT NULL,
    "device_id" "text",
    "is_online" boolean DEFAULT false NOT NULL,
    "last_heartbeat_at" timestamp with time zone,
    "current_user_id" "uuid",
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "registration_code" "text",
    "registration_code_expires_at" timestamp with time zone,
    "device_fingerprint" "jsonb",
    "assigned_printer_id" "uuid",
    "default_view" "text" DEFAULT 'pos'::"text"
);


ALTER TABLE "public"."terminals" OWNER TO "postgres";


COMMENT ON COLUMN "public"."terminals"."registration_code" IS '6-digit code for device registration, cleared after activation';



COMMENT ON COLUMN "public"."terminals"."registration_code_expires_at" IS 'Expiry time for registration code (10 min TTL)';



COMMENT ON COLUMN "public"."terminals"."device_fingerprint" IS 'Device info: user_agent, screen_width, screen_height, platform, standalone';



COMMENT ON COLUMN "public"."terminals"."assigned_printer_id" IS 'FK to printers table (nullable)';



COMMENT ON COLUMN "public"."terminals"."default_view" IS 'Default screen: pos, kds, customer_display, kiosk';



CREATE TABLE IF NOT EXISTS "public"."time_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "shift_id" "uuid",
    "clock_in" timestamp with time zone NOT NULL,
    "clock_out" timestamp with time zone,
    "role_during_shift" "public"."user_role",
    "hourly_rate" numeric(8,2),
    "regular_hours" numeric(5,2),
    "overtime_hours" numeric(5,2),
    "total_pay" numeric(10,2),
    "cash_tips" numeric(10,2) DEFAULT 0 NOT NULL,
    "credit_tips" numeric(10,2) DEFAULT 0 NOT NULL,
    "tip_out_given" numeric(10,2) DEFAULT 0 NOT NULL,
    "tip_out_received" numeric(10,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "is_approved" boolean DEFAULT false NOT NULL,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."time_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tip_adjustments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "server_id" "uuid" NOT NULL,
    "original_tip" numeric(10,2) NOT NULL,
    "adjusted_tip" numeric(10,2) NOT NULL,
    "reason" "text",
    "adjusted_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tip_adjustments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tip_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "calculate_on" "text" DEFAULT 'pre_tax'::"text",
    "suggested_percentages" integer[] DEFAULT '{18,20,22}'::integer[],
    "default_percentage" integer DEFAULT 20,
    "auto_grat_enabled" boolean DEFAULT true,
    "auto_grat_party_size" integer DEFAULT 6,
    "auto_grat_percentage" integer DEFAULT 20,
    "distribution_model" "text" DEFAULT 'direct'::"text",
    "tipout_rules" "jsonb" DEFAULT '[]'::"jsonb",
    "pool_method" "text" DEFAULT 'hours_worked'::"text",
    "pool_point_values" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tip_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tip_distributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "shift_date" "date" NOT NULL,
    "payment_id" "uuid",
    "order_id" "uuid",
    "tip_amount" numeric(10,2) NOT NULL,
    "tip_type" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "distribution_method" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "tipout_from_user_id" "uuid",
    "tipout_percentage" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tip_distributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_permission_overrides" (
    "user_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "granted" boolean NOT NULL
);


ALTER TABLE "public"."user_permission_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "email" "text",
    "phone" "text",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "pin_hash" "text",
    "role" "public"."user_role" DEFAULT 'server'::"public"."user_role" NOT NULL,
    "location_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "hire_date" "date",
    "hourly_rate" numeric(8,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "contact_name" "text",
    "email" "text",
    "phone" "text",
    "address" "jsonb",
    "payment_terms" "text",
    "account_number" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vendors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "guest_name" "text" NOT NULL,
    "guest_phone" "text",
    "party_size" integer NOT NULL,
    "quoted_wait_minutes" integer,
    "position" integer NOT NULL,
    "status" "text" DEFAULT 'waiting'::"text" NOT NULL,
    "notified_at" timestamp with time zone,
    "seated_at" timestamp with time zone,
    "table_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."waitlist_entries" OWNER TO "postgres";


ALTER TABLE ONLY "public"."accounting_integrations"
    ADD CONSTRAINT "accounting_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."accounting_sync_log"
    ADD CONSTRAINT "accounting_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_insights"
    ADD CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_predictions"
    ADD CONSTRAINT "ai_predictions_org_id_location_id_prediction_date_key" UNIQUE ("org_id", "location_id", "prediction_date");



ALTER TABLE ONLY "public"."ai_predictions"
    ADD CONSTRAINT "ai_predictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_settings"
    ADD CONSTRAINT "ai_settings_org_id_key" UNIQUE ("org_id");



ALTER TABLE ONLY "public"."ai_settings"
    ADD CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."break_entries"
    ADD CONSTRAINT "break_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_recipients"
    ADD CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cash_drawer_events"
    ADD CONSTRAINT "cash_drawer_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cash_drawers"
    ADD CONSTRAINT "cash_drawers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cash_tip_reports"
    ADD CONSTRAINT "cash_tip_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cash_tip_reports"
    ADD CONSTRAINT "cash_tip_reports_user_id_shift_date_key" UNIQUE ("user_id", "shift_date");



ALTER TABLE ONLY "public"."catering_events"
    ADD CONSTRAINT "catering_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catering_menus"
    ADD CONSTRAINT "catering_menus_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chargebacks"
    ADD CONSTRAINT "chargebacks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_addresses"
    ADD CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_payment_methods"
    ADD CONSTRAINT "customer_payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_item_metrics"
    ADD CONSTRAINT "daily_item_metrics_location_id_metric_date_menu_item_id_key" UNIQUE ("location_id", "metric_date", "menu_item_id");



ALTER TABLE ONLY "public"."daily_item_metrics"
    ADD CONSTRAINT "daily_item_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_metrics"
    ADD CONSTRAINT "daily_metrics_location_id_metric_date_key" UNIQUE ("location_id", "metric_date");



ALTER TABLE ONLY "public"."daily_metrics"
    ADD CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_reconciliations"
    ADD CONSTRAINT "daily_reconciliations_location_id_business_date_key" UNIQUE ("location_id", "business_date");



ALTER TABLE ONLY "public"."daily_reconciliations"
    ADD CONSTRAINT "daily_reconciliations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_zones"
    ADD CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."demo_requests"
    ADD CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."digital_menu_boards"
    ADD CONSTRAINT "digital_menu_boards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discounts"
    ADD CONSTRAINT "discounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drive_thru_cars"
    ADD CONSTRAINT "drive_thru_cars_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drive_thru_lanes"
    ADD CONSTRAINT "drive_thru_lanes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drive_thru_orders"
    ADD CONSTRAINT "drive_thru_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."floor_plans"
    ADD CONSTRAINT "floor_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."franchise_royalties"
    ADD CONSTRAINT "franchise_royalties_location_id_period_start_period_end_key" UNIQUE ("location_id", "period_start", "period_end");



ALTER TABLE ONLY "public"."franchise_royalties"
    ADD CONSTRAINT "franchise_royalties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gift_card_transactions"
    ADD CONSTRAINT "gift_card_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gift_cards"
    ADD CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."house_account_transactions"
    ADD CONSTRAINT "house_account_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."house_accounts"
    ADD CONSTRAINT "house_accounts_org_id_account_number_key" UNIQUE ("org_id", "account_number");



ALTER TABLE ONLY "public"."house_accounts"
    ADD CONSTRAINT "house_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_waste_log"
    ADD CONSTRAINT "inventory_waste_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kds_stations"
    ADD CONSTRAINT "kds_stations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kds_ticket_events"
    ADD CONSTRAINT "kds_ticket_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_org_id_slug_key" UNIQUE ("org_id", "slug");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_accounts"
    ADD CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_programs"
    ADD CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_item_modifier_groups"
    ADD CONSTRAINT "menu_item_modifier_groups_pkey" PRIMARY KEY ("menu_item_id", "modifier_group_id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modifier_groups"
    ADD CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modifiers"
    ADD CONSTRAINT "modifiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."module_migrations"
    ADD CONSTRAINT "module_migrations_org_id_module_id_migration_name_key" UNIQUE ("org_id", "module_id", "migration_name");



ALTER TABLE ONLY "public"."module_migrations"
    ADD CONSTRAINT "module_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."online_menu_items"
    ADD CONSTRAINT "online_menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."online_menus"
    ADD CONSTRAINT "online_menus_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."online_order_queue"
    ADD CONSTRAINT "online_order_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_discounts"
    ADD CONSTRAINT "order_discounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_item_modifiers"
    ADD CONSTRAINT "order_item_modifiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_modifications"
    ADD CONSTRAINT "order_modifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_throttle_config"
    ADD CONSTRAINT "order_throttle_config_org_id_location_id_key" UNIQUE ("org_id", "location_id");



ALTER TABLE ONLY "public"."order_throttle_config"
    ADD CONSTRAINT "order_throttle_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."org_modules"
    ADD CONSTRAINT "org_modules_org_id_module_id_key" UNIQUE ("org_id", "module_id");



ALTER TABLE ONLY "public"."org_modules"
    ADD CONSTRAINT "org_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."payment_devices"
    ADD CONSTRAINT "payment_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_level_prices"
    ADD CONSTRAINT "price_level_prices_menu_item_id_price_level_id_key" UNIQUE ("menu_item_id", "price_level_id");



ALTER TABLE ONLY "public"."price_level_prices"
    ADD CONSTRAINT "price_level_prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_level_schedules"
    ADD CONSTRAINT "price_level_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_levels"
    ADD CONSTRAINT "price_levels_org_id_level_number_key" UNIQUE ("org_id", "level_number");



ALTER TABLE ONLY "public"."price_levels"
    ADD CONSTRAINT "price_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."print_queue"
    ADD CONSTRAINT "print_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."print_routing"
    ADD CONSTRAINT "print_routing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."printers"
    ADD CONSTRAINT "printers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qr_menus"
    ADD CONSTRAINT "qr_menus_org_id_slug_key" UNIQUE ("org_id", "slug");



ALTER TABLE ONLY "public"."qr_menus"
    ADD CONSTRAINT "qr_menus_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qr_orders"
    ADD CONSTRAINT "qr_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receipt_config"
    ADD CONSTRAINT "receipt_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role", "permission_id");



ALTER TABLE ONLY "public"."schedule_templates"
    ADD CONSTRAINT "schedule_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scheduled_shifts"
    ADD CONSTRAINT "scheduled_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlement_batches"
    ADD CONSTRAINT "settlement_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."setup_progress"
    ADD CONSTRAINT "setup_progress_org_id_key" UNIQUE ("org_id");



ALTER TABLE ONLY "public"."setup_progress"
    ADD CONSTRAINT "setup_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shift_marketplace"
    ADD CONSTRAINT "shift_marketplace_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shift_swap_requests"
    ADD CONSTRAINT "shift_swap_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_availability"
    ADD CONSTRAINT "staff_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."surcharge_config"
    ADD CONSTRAINT "surcharge_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tax_rates"
    ADD CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."terminals"
    ADD CONSTRAINT "terminals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tip_adjustments"
    ADD CONSTRAINT "tip_adjustments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tip_config"
    ADD CONSTRAINT "tip_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tip_distributions"
    ADD CONSTRAINT "tip_distributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_permission_overrides"
    ADD CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("user_id", "permission_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist_entries"
    ADD CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "idx_accounting_integrations_org" ON "public"."accounting_integrations" USING "btree" ("org_id", "provider");



CREATE INDEX "idx_ai_conversations_user" ON "public"."ai_conversations" USING "btree" ("org_id", "user_id", "updated_at" DESC);



CREATE INDEX "idx_ai_insights_dedup" ON "public"."ai_insights" USING "btree" ("org_id", "location_id", "category", "title", "generated_at" DESC);



CREATE INDEX "idx_ai_insights_org_location" ON "public"."ai_insights" USING "btree" ("org_id", "location_id", "is_dismissed", "generated_at" DESC);



CREATE INDEX "idx_ai_predictions_accuracy" ON "public"."ai_predictions" USING "btree" ("org_id", "location_id", "prediction_date") WHERE ("actual_revenue" IS NOT NULL);



CREATE INDEX "idx_ai_predictions_lookup" ON "public"."ai_predictions" USING "btree" ("org_id", "location_id", "prediction_date");



CREATE INDEX "idx_ai_usage_org_date" ON "public"."ai_usage" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "idx_ai_usage_user_date" ON "public"."ai_usage" USING "btree" ("org_id", "user_id", "created_at" DESC);



CREATE INDEX "idx_audit_action" ON "public"."audit_log" USING "btree" ("action");



CREATE INDEX "idx_audit_entity" ON "public"."audit_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_audit_org_date" ON "public"."audit_log" USING "btree" ("org_id", "created_at" DESC);



CREATE INDEX "idx_audit_user" ON "public"."audit_log" USING "btree" ("user_id");



CREATE INDEX "idx_batch_org_date" ON "public"."settlement_batches" USING "btree" ("org_id", "batch_closed_at");



CREATE INDEX "idx_cash_events_drawer" ON "public"."cash_drawer_events" USING "btree" ("cash_drawer_id");



CREATE INDEX "idx_cpm_customer" ON "public"."customer_payment_methods" USING "btree" ("customer_id");



CREATE INDEX "idx_customers_email" ON "public"."customers" USING "btree" ("org_id", "email") WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_customers_org" ON "public"."customers" USING "btree" ("org_id");



CREATE INDEX "idx_customers_org_email" ON "public"."customers" USING "btree" ("org_id", "email") WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_customers_org_phone" ON "public"."customers" USING "btree" ("org_id", "phone") WHERE ("phone" IS NOT NULL);



CREATE INDEX "idx_customers_phone" ON "public"."customers" USING "btree" ("org_id", "phone") WHERE ("phone" IS NOT NULL);



CREATE INDEX "idx_daily_metrics_location_date" ON "public"."daily_metrics" USING "btree" ("location_id", "metric_date" DESC);



CREATE INDEX "idx_demo_requests_date" ON "public"."demo_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_demo_requests_email" ON "public"."demo_requests" USING "btree" ("email");



CREATE INDEX "idx_discounts_org" ON "public"."discounts" USING "btree" ("org_id");



CREATE INDEX "idx_drive_thru_location_date" ON "public"."drive_thru_orders" USING "btree" ("location_id", "created_at");



CREATE INDEX "idx_gift_cards_number" ON "public"."gift_cards" USING "btree" ("card_number_hash");



CREATE INDEX "idx_gift_cards_org" ON "public"."gift_cards" USING "btree" ("org_id");



CREATE INDEX "idx_house_acct_txn_account" ON "public"."house_account_transactions" USING "btree" ("house_account_id", "created_at" DESC);



CREATE INDEX "idx_inventory_items_location_quantity" ON "public"."inventory_items" USING "btree" ("location_id", "current_quantity");



CREATE INDEX "idx_locations_org" ON "public"."locations" USING "btree" ("org_id");



CREATE INDEX "idx_menu_categories_location" ON "public"."menu_categories" USING "btree" ("location_id");



CREATE INDEX "idx_menu_categories_org" ON "public"."menu_categories" USING "btree" ("org_id");



CREATE INDEX "idx_menu_items_category" ON "public"."menu_items" USING "btree" ("category_id");



CREATE INDEX "idx_menu_items_location" ON "public"."menu_items" USING "btree" ("location_id");



CREATE INDEX "idx_menu_items_org" ON "public"."menu_items" USING "btree" ("org_id");



CREATE INDEX "idx_menu_items_plu" ON "public"."menu_items" USING "btree" ("org_id", "plu_code") WHERE ("plu_code" IS NOT NULL);



CREATE INDEX "idx_modifier_groups_org" ON "public"."modifier_groups" USING "btree" ("org_id");



CREATE INDEX "idx_modifiers_group" ON "public"."modifiers" USING "btree" ("modifier_group_id");



CREATE INDEX "idx_order_item_modifiers_item" ON "public"."order_item_modifiers" USING "btree" ("order_item_id");



CREATE INDEX "idx_order_items_menu_item" ON "public"."order_items" USING "btree" ("menu_item_id");



CREATE INDEX "idx_order_items_menu_item_created" ON "public"."order_items" USING "btree" ("menu_item_id", "created_at" DESC);



CREATE INDEX "idx_order_items_order" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_org" ON "public"."order_items" USING "btree" ("org_id");



CREATE INDEX "idx_order_items_status" ON "public"."order_items" USING "btree" ("order_id", "is_sent", "is_voided");



CREATE INDEX "idx_order_mods_order" ON "public"."order_modifications" USING "btree" ("order_id");



CREATE INDEX "idx_order_mods_org" ON "public"."order_modifications" USING "btree" ("org_id");



CREATE INDEX "idx_orders_customer" ON "public"."orders" USING "btree" ("customer_id") WHERE ("customer_id" IS NOT NULL);



CREATE INDEX "idx_orders_location" ON "public"."orders" USING "btree" ("location_id");



CREATE INDEX "idx_orders_location_status_created" ON "public"."orders" USING "btree" ("location_id", "status", "created_at" DESC);



CREATE INDEX "idx_orders_number" ON "public"."orders" USING "btree" ("location_id", "order_number");



CREATE INDEX "idx_orders_opened" ON "public"."orders" USING "btree" ("location_id", "opened_at");



CREATE INDEX "idx_orders_org" ON "public"."orders" USING "btree" ("org_id");



CREATE INDEX "idx_orders_server" ON "public"."orders" USING "btree" ("server_id");



CREATE INDEX "idx_orders_server_created" ON "public"."orders" USING "btree" ("server_id", "created_at" DESC);



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("location_id", "status");



CREATE INDEX "idx_orders_table" ON "public"."orders" USING "btree" ("table_id") WHERE ("table_id" IS NOT NULL);



CREATE INDEX "idx_org_modules_org" ON "public"."org_modules" USING "btree" ("org_id");



CREATE INDEX "idx_payments_location_created" ON "public"."payments" USING "btree" ("location_id", "created_at" DESC);



CREATE INDEX "idx_payments_order" ON "public"."payments" USING "btree" ("order_id");



CREATE INDEX "idx_payments_order_id" ON "public"."payments" USING "btree" ("order_id");



CREATE INDEX "idx_payments_org" ON "public"."payments" USING "btree" ("org_id");



CREATE INDEX "idx_payments_processor_txn" ON "public"."payments" USING "btree" ("processor_transaction_id") WHERE ("processor_transaction_id" IS NOT NULL);



CREATE INDEX "idx_reservations_location_date_status" ON "public"."reservations" USING "btree" ("location_id", "reservation_date", "status");



CREATE INDEX "idx_shifts_location_date" ON "public"."shifts" USING "btree" ("location_id", "shift_date");



CREATE INDEX "idx_tables_floor_plan" ON "public"."tables" USING "btree" ("floor_plan_id");



CREATE INDEX "idx_tables_location" ON "public"."tables" USING "btree" ("location_id");



CREATE INDEX "idx_tables_location_status" ON "public"."tables" USING "btree" ("location_id", "status");



CREATE INDEX "idx_tables_status" ON "public"."tables" USING "btree" ("location_id", "status");



CREATE INDEX "idx_tax_rates_location" ON "public"."tax_rates" USING "btree" ("location_id");



CREATE INDEX "idx_tax_rates_org" ON "public"."tax_rates" USING "btree" ("org_id");



CREATE INDEX "idx_terminals_location" ON "public"."terminals" USING "btree" ("location_id");



CREATE INDEX "idx_time_entries_location_date" ON "public"."time_entries" USING "btree" ("location_id", "clock_in");



CREATE INDEX "idx_time_entries_user" ON "public"."time_entries" USING "btree" ("user_id");



CREATE INDEX "idx_time_entries_user_clock_in" ON "public"."time_entries" USING "btree" ("user_id", "clock_in" DESC);



CREATE INDEX "idx_tip_distributions_org_date" ON "public"."tip_distributions" USING "btree" ("org_id", "shift_date");



CREATE INDEX "idx_tip_distributions_user_date" ON "public"."tip_distributions" USING "btree" ("user_id", "shift_date");



CREATE INDEX "idx_users_email" ON "public"."users" USING "btree" ("email");



CREATE INDEX "idx_users_org" ON "public"."users" USING "btree" ("org_id");



CREATE INDEX "idx_users_pin" ON "public"."users" USING "btree" ("org_id", "pin_hash") WHERE ("pin_hash" IS NOT NULL);



ALTER TABLE ONLY "public"."accounting_integrations"
    ADD CONSTRAINT "accounting_integrations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."accounting_sync_log"
    ADD CONSTRAINT "accounting_sync_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_insights"
    ADD CONSTRAINT "ai_insights_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_insights"
    ADD CONSTRAINT "ai_insights_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_predictions"
    ADD CONSTRAINT "ai_predictions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_predictions"
    ADD CONSTRAINT "ai_predictions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_settings"
    ADD CONSTRAINT "ai_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."break_entries"
    ADD CONSTRAINT "break_entries_time_entry_id_fkey" FOREIGN KEY ("time_entry_id") REFERENCES "public"."time_entries"("id");



ALTER TABLE ONLY "public"."campaign_recipients"
    ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id");



ALTER TABLE ONLY "public"."campaign_recipients"
    ADD CONSTRAINT "campaign_recipients_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."cash_drawer_events"
    ADD CONSTRAINT "cash_drawer_events_cash_drawer_id_fkey" FOREIGN KEY ("cash_drawer_id") REFERENCES "public"."cash_drawers"("id");



ALTER TABLE ONLY "public"."cash_drawer_events"
    ADD CONSTRAINT "cash_drawer_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."cash_drawer_events"
    ADD CONSTRAINT "cash_drawer_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id");



ALTER TABLE ONLY "public"."cash_drawer_events"
    ADD CONSTRAINT "cash_drawer_events_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."cash_drawers"
    ADD CONSTRAINT "cash_drawers_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."cash_drawers"
    ADD CONSTRAINT "cash_drawers_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."cash_drawers"
    ADD CONSTRAINT "cash_drawers_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."cash_drawers"
    ADD CONSTRAINT "cash_drawers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."cash_drawers"
    ADD CONSTRAINT "cash_drawers_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "public"."terminals"("id");



ALTER TABLE ONLY "public"."cash_tip_reports"
    ADD CONSTRAINT "cash_tip_reports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."cash_tip_reports"
    ADD CONSTRAINT "cash_tip_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."catering_events"
    ADD CONSTRAINT "catering_events_catering_menu_id_fkey" FOREIGN KEY ("catering_menu_id") REFERENCES "public"."catering_menus"("id");



ALTER TABLE ONLY "public"."catering_events"
    ADD CONSTRAINT "catering_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."catering_events"
    ADD CONSTRAINT "catering_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."catering_events"
    ADD CONSTRAINT "catering_events_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."catering_events"
    ADD CONSTRAINT "catering_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."catering_events"
    ADD CONSTRAINT "catering_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."catering_menus"
    ADD CONSTRAINT "catering_menus_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."chargebacks"
    ADD CONSTRAINT "chargebacks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."chargebacks"
    ADD CONSTRAINT "chargebacks_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id");



ALTER TABLE ONLY "public"."customer_addresses"
    ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."customer_payment_methods"
    ADD CONSTRAINT "customer_payment_methods_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."customer_payment_methods"
    ADD CONSTRAINT "customer_payment_methods_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."daily_item_metrics"
    ADD CONSTRAINT "daily_item_metrics_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."daily_item_metrics"
    ADD CONSTRAINT "daily_item_metrics_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id");



ALTER TABLE ONLY "public"."daily_item_metrics"
    ADD CONSTRAINT "daily_item_metrics_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."daily_metrics"
    ADD CONSTRAINT "daily_metrics_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."daily_metrics"
    ADD CONSTRAINT "daily_metrics_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."daily_reconciliations"
    ADD CONSTRAINT "daily_reconciliations_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."daily_reconciliations"
    ADD CONSTRAINT "daily_reconciliations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."daily_reconciliations"
    ADD CONSTRAINT "daily_reconciliations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."delivery_zones"("id");



ALTER TABLE ONLY "public"."delivery_zones"
    ADD CONSTRAINT "delivery_zones_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."delivery_zones"
    ADD CONSTRAINT "delivery_zones_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."digital_menu_boards"
    ADD CONSTRAINT "digital_menu_boards_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."digital_menu_boards"
    ADD CONSTRAINT "digital_menu_boards_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."discounts"
    ADD CONSTRAINT "discounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."drive_thru_cars"
    ADD CONSTRAINT "drive_thru_cars_lane_id_fkey" FOREIGN KEY ("lane_id") REFERENCES "public"."drive_thru_lanes"("id");



ALTER TABLE ONLY "public"."drive_thru_cars"
    ADD CONSTRAINT "drive_thru_cars_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."drive_thru_cars"
    ADD CONSTRAINT "drive_thru_cars_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."drive_thru_lanes"
    ADD CONSTRAINT "drive_thru_lanes_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."drive_thru_lanes"
    ADD CONSTRAINT "drive_thru_lanes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."drive_thru_orders"
    ADD CONSTRAINT "drive_thru_orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."drive_thru_orders"
    ADD CONSTRAINT "drive_thru_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."drive_thru_orders"
    ADD CONSTRAINT "drive_thru_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."floor_plans"
    ADD CONSTRAINT "floor_plans_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."floor_plans"
    ADD CONSTRAINT "floor_plans_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."franchise_royalties"
    ADD CONSTRAINT "franchise_royalties_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."franchise_royalties"
    ADD CONSTRAINT "franchise_royalties_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."gift_card_transactions"
    ADD CONSTRAINT "gift_card_transactions_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_cards"("id");



ALTER TABLE ONLY "public"."gift_card_transactions"
    ADD CONSTRAINT "gift_card_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."gift_card_transactions"
    ADD CONSTRAINT "gift_card_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id");



ALTER TABLE ONLY "public"."gift_card_transactions"
    ADD CONSTRAINT "gift_card_transactions_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."gift_cards"
    ADD CONSTRAINT "gift_cards_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."gift_cards"
    ADD CONSTRAINT "gift_cards_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."gift_cards"
    ADD CONSTRAINT "gift_cards_purchased_by_customer_id_fkey" FOREIGN KEY ("purchased_by_customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."house_account_transactions"
    ADD CONSTRAINT "house_account_transactions_house_account_id_fkey" FOREIGN KEY ("house_account_id") REFERENCES "public"."house_accounts"("id");



ALTER TABLE ONLY "public"."house_account_transactions"
    ADD CONSTRAINT "house_account_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."house_account_transactions"
    ADD CONSTRAINT "house_account_transactions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."house_account_transactions"
    ADD CONSTRAINT "house_account_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id");



ALTER TABLE ONLY "public"."house_account_transactions"
    ADD CONSTRAINT "house_account_transactions_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."house_accounts"
    ADD CONSTRAINT "house_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."house_accounts"
    ADD CONSTRAINT "house_accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."inventory_transactions"
    ADD CONSTRAINT "inventory_transactions_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."inventory_waste_log"
    ADD CONSTRAINT "inventory_waste_log_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."inventory_waste_log"
    ADD CONSTRAINT "inventory_waste_log_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."inventory_waste_log"
    ADD CONSTRAINT "inventory_waste_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."inventory_waste_log"
    ADD CONSTRAINT "inventory_waste_log_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."kds_stations"
    ADD CONSTRAINT "kds_stations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."kds_stations"
    ADD CONSTRAINT "kds_stations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."kds_stations"
    ADD CONSTRAINT "kds_stations_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "public"."terminals"("id");



ALTER TABLE ONLY "public"."kds_ticket_events"
    ADD CONSTRAINT "kds_ticket_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."kds_ticket_events"
    ADD CONSTRAINT "kds_ticket_events_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id");



ALTER TABLE ONLY "public"."kds_ticket_events"
    ADD CONSTRAINT "kds_ticket_events_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."kds_ticket_events"
    ADD CONSTRAINT "kds_ticket_events_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."kds_stations"("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."loyalty_accounts"
    ADD CONSTRAINT "loyalty_accounts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."loyalty_accounts"
    ADD CONSTRAINT "loyalty_accounts_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_programs"("id");



ALTER TABLE ONLY "public"."loyalty_programs"
    ADD CONSTRAINT "loyalty_programs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_loyalty_account_id_fkey" FOREIGN KEY ("loyalty_account_id") REFERENCES "public"."loyalty_accounts"("id");



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."menu_categories"
    ADD CONSTRAINT "menu_categories_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."menu_item_modifier_groups"
    ADD CONSTRAINT "menu_item_modifier_groups_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id");



ALTER TABLE ONLY "public"."menu_item_modifier_groups"
    ADD CONSTRAINT "menu_item_modifier_groups_modifier_group_id_fkey" FOREIGN KEY ("modifier_group_id") REFERENCES "public"."modifier_groups"("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rates"("id");



ALTER TABLE ONLY "public"."modifier_groups"
    ADD CONSTRAINT "modifier_groups_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."modifiers"
    ADD CONSTRAINT "modifiers_modifier_group_id_fkey" FOREIGN KEY ("modifier_group_id") REFERENCES "public"."modifier_groups"("id");



ALTER TABLE ONLY "public"."modifiers"
    ADD CONSTRAINT "modifiers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."module_migrations"
    ADD CONSTRAINT "module_migrations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."online_menu_items"
    ADD CONSTRAINT "online_menu_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id");



ALTER TABLE ONLY "public"."online_menu_items"
    ADD CONSTRAINT "online_menu_items_online_menu_id_fkey" FOREIGN KEY ("online_menu_id") REFERENCES "public"."online_menus"("id");



ALTER TABLE ONLY "public"."online_menus"
    ADD CONSTRAINT "online_menus_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."online_menus"
    ADD CONSTRAINT "online_menus_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."online_order_queue"
    ADD CONSTRAINT "online_order_queue_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."online_order_queue"
    ADD CONSTRAINT "online_order_queue_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."online_order_queue"
    ADD CONSTRAINT "online_order_queue_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."online_order_queue"
    ADD CONSTRAINT "online_order_queue_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."order_discounts"
    ADD CONSTRAINT "order_discounts_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."order_discounts"
    ADD CONSTRAINT "order_discounts_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."order_discounts"
    ADD CONSTRAINT "order_discounts_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id");



ALTER TABLE ONLY "public"."order_discounts"
    ADD CONSTRAINT "order_discounts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."order_discounts"
    ADD CONSTRAINT "order_discounts_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id");



ALTER TABLE ONLY "public"."order_item_modifiers"
    ADD CONSTRAINT "order_item_modifiers_modifier_group_id_fkey" FOREIGN KEY ("modifier_group_id") REFERENCES "public"."modifier_groups"("id");



ALTER TABLE ONLY "public"."order_item_modifiers"
    ADD CONSTRAINT "order_item_modifiers_modifier_id_fkey" FOREIGN KEY ("modifier_id") REFERENCES "public"."modifiers"("id");



ALTER TABLE ONLY "public"."order_item_modifiers"
    ADD CONSTRAINT "order_item_modifiers_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_comped_by_fkey" FOREIGN KEY ("comped_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."order_modifications"
    ADD CONSTRAINT "order_modifications_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."order_modifications"
    ADD CONSTRAINT "order_modifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."order_modifications"
    ADD CONSTRAINT "order_modifications_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id");



ALTER TABLE ONLY "public"."order_modifications"
    ADD CONSTRAINT "order_modifications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."order_modifications"
    ADD CONSTRAINT "order_modifications_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."order_throttle_config"
    ADD CONSTRAINT "order_throttle_config_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."order_throttle_config"
    ADD CONSTRAINT "order_throttle_config_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_split_from_order_id_fkey" FOREIGN KEY ("split_from_order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "public"."terminals"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."org_modules"
    ADD CONSTRAINT "org_modules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."payment_devices"
    ADD CONSTRAINT "payment_devices_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."payment_devices"
    ADD CONSTRAINT "payment_devices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_cards"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_original_payment_id_fkey" FOREIGN KEY ("original_payment_id") REFERENCES "public"."payments"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_refunded_by_fkey" FOREIGN KEY ("refunded_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."price_level_prices"
    ADD CONSTRAINT "price_level_prices_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id");



ALTER TABLE ONLY "public"."price_level_prices"
    ADD CONSTRAINT "price_level_prices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."price_level_prices"
    ADD CONSTRAINT "price_level_prices_price_level_id_fkey" FOREIGN KEY ("price_level_id") REFERENCES "public"."price_levels"("id");



ALTER TABLE ONLY "public"."price_level_schedules"
    ADD CONSTRAINT "price_level_schedules_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."price_level_schedules"
    ADD CONSTRAINT "price_level_schedules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."price_level_schedules"
    ADD CONSTRAINT "price_level_schedules_price_level_id_fkey" FOREIGN KEY ("price_level_id") REFERENCES "public"."price_levels"("id");



ALTER TABLE ONLY "public"."price_levels"
    ADD CONSTRAINT "price_levels_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."print_queue"
    ADD CONSTRAINT "print_queue_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."print_queue"
    ADD CONSTRAINT "print_queue_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id");



ALTER TABLE ONLY "public"."print_routing"
    ADD CONSTRAINT "print_routing_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."print_routing"
    ADD CONSTRAINT "print_routing_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."print_routing"
    ADD CONSTRAINT "print_routing_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id");



ALTER TABLE ONLY "public"."printers"
    ADD CONSTRAINT "printers_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."printers"
    ADD CONSTRAINT "printers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."qr_menus"
    ADD CONSTRAINT "qr_menus_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."qr_menus"
    ADD CONSTRAINT "qr_menus_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."qr_orders"
    ADD CONSTRAINT "qr_orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."qr_orders"
    ADD CONSTRAINT "qr_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."qr_orders"
    ADD CONSTRAINT "qr_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."qr_orders"
    ADD CONSTRAINT "qr_orders_qr_menu_id_fkey" FOREIGN KEY ("qr_menu_id") REFERENCES "public"."qr_menus"("id");



ALTER TABLE ONLY "public"."qr_orders"
    ADD CONSTRAINT "qr_orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id");



ALTER TABLE ONLY "public"."receipt_config"
    ADD CONSTRAINT "receipt_config_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."receipt_config"
    ADD CONSTRAINT "receipt_config_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id");



ALTER TABLE ONLY "public"."recipes"
    ADD CONSTRAINT "recipes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id");



ALTER TABLE ONLY "public"."schedule_templates"
    ADD CONSTRAINT "schedule_templates_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."schedule_templates"
    ADD CONSTRAINT "schedule_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."scheduled_shifts"
    ADD CONSTRAINT "scheduled_shifts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."scheduled_shifts"
    ADD CONSTRAINT "scheduled_shifts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."scheduled_shifts"
    ADD CONSTRAINT "scheduled_shifts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."schedule_templates"("id");



ALTER TABLE ONLY "public"."scheduled_shifts"
    ADD CONSTRAINT "scheduled_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."settlement_batches"
    ADD CONSTRAINT "settlement_batches_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."settlement_batches"
    ADD CONSTRAINT "settlement_batches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."setup_progress"
    ADD CONSTRAINT "setup_progress_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shift_marketplace"
    ADD CONSTRAINT "shift_marketplace_claimed_by_fkey" FOREIGN KEY ("claimed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."shift_marketplace"
    ADD CONSTRAINT "shift_marketplace_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."shift_marketplace"
    ADD CONSTRAINT "shift_marketplace_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."shift_marketplace"
    ADD CONSTRAINT "shift_marketplace_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id");



ALTER TABLE ONLY "public"."shift_swap_requests"
    ADD CONSTRAINT "shift_swap_requests_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."shift_swap_requests"
    ADD CONSTRAINT "shift_swap_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."shift_swap_requests"
    ADD CONSTRAINT "shift_swap_requests_scheduled_shift_id_fkey" FOREIGN KEY ("scheduled_shift_id") REFERENCES "public"."scheduled_shifts"("id");



ALTER TABLE ONLY "public"."shift_swap_requests"
    ADD CONSTRAINT "shift_swap_requests_swap_with_user_id_fkey" FOREIGN KEY ("swap_with_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."staff_availability"
    ADD CONSTRAINT "staff_availability_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."staff_availability"
    ADD CONSTRAINT "staff_availability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."surcharge_config"
    ADD CONSTRAINT "surcharge_config_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."surcharge_config"
    ADD CONSTRAINT "surcharge_config_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_current_server_id_fkey" FOREIGN KEY ("current_server_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_floor_plan_id_fkey" FOREIGN KEY ("floor_plan_id") REFERENCES "public"."floor_plans"("id");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."tables"
    ADD CONSTRAINT "tables_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."tax_rates"
    ADD CONSTRAINT "tax_rates_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."tax_rates"
    ADD CONSTRAINT "tax_rates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."terminals"
    ADD CONSTRAINT "terminals_current_user_id_fkey" FOREIGN KEY ("current_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."terminals"
    ADD CONSTRAINT "terminals_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."terminals"
    ADD CONSTRAINT "terminals_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id");



ALTER TABLE ONLY "public"."time_entries"
    ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tip_adjustments"
    ADD CONSTRAINT "tip_adjustments_adjusted_by_fkey" FOREIGN KEY ("adjusted_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tip_adjustments"
    ADD CONSTRAINT "tip_adjustments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."tip_adjustments"
    ADD CONSTRAINT "tip_adjustments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."tip_adjustments"
    ADD CONSTRAINT "tip_adjustments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id");



ALTER TABLE ONLY "public"."tip_adjustments"
    ADD CONSTRAINT "tip_adjustments_server_id_fkey" FOREIGN KEY ("server_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tip_config"
    ADD CONSTRAINT "tip_config_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."tip_config"
    ADD CONSTRAINT "tip_config_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."tip_distributions"
    ADD CONSTRAINT "tip_distributions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."tip_distributions"
    ADD CONSTRAINT "tip_distributions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."tip_distributions"
    ADD CONSTRAINT "tip_distributions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id");



ALTER TABLE ONLY "public"."tip_distributions"
    ADD CONSTRAINT "tip_distributions_tipout_from_user_id_fkey" FOREIGN KEY ("tipout_from_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tip_distributions"
    ADD CONSTRAINT "tip_distributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_permission_overrides"
    ADD CONSTRAINT "user_permission_overrides_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id");



ALTER TABLE ONLY "public"."user_permission_overrides"
    ADD CONSTRAINT "user_permission_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."waitlist_entries"
    ADD CONSTRAINT "waitlist_entries_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."waitlist_entries"
    ADD CONSTRAINT "waitlist_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."waitlist_entries"
    ADD CONSTRAINT "waitlist_entries_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id");



ALTER TABLE "public"."accounting_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."accounting_sync_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_conversations_user_access" ON "public"."ai_conversations" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."ai_insights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_insights_org_access" ON "public"."ai_insights" USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



ALTER TABLE "public"."ai_predictions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_predictions_org_access" ON "public"."ai_predictions" USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



ALTER TABLE "public"."ai_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_settings_org_access" ON "public"."ai_settings" USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



ALTER TABLE "public"."ai_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_usage_insert" ON "public"."ai_usage" FOR INSERT WITH CHECK (true);



CREATE POLICY "ai_usage_org_read" ON "public"."ai_usage" FOR SELECT USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "allow_delete" ON "public"."customer_addresses" FOR DELETE USING (true);



CREATE POLICY "allow_delete" ON "public"."menu_item_modifier_groups" FOR DELETE USING (true);



CREATE POLICY "allow_delete" ON "public"."online_menu_items" FOR DELETE USING (true);



CREATE POLICY "allow_delete" ON "public"."order_discounts" FOR DELETE USING (true);



CREATE POLICY "allow_delete" ON "public"."order_item_modifiers" FOR DELETE USING (true);



CREATE POLICY "allow_delete" ON "public"."user_permission_overrides" FOR DELETE USING (true);



CREATE POLICY "allow_insert" ON "public"."break_entries" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow_insert" ON "public"."campaign_recipients" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow_insert" ON "public"."cash_drawer_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow_insert" ON "public"."customer_addresses" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow_insert" ON "public"."gift_card_transactions" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow_insert" ON "public"."menu_item_modifier_groups" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow_insert" ON "public"."online_menu_items" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow_insert" ON "public"."order_discounts" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow_insert" ON "public"."order_item_modifiers" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow_insert" ON "public"."purchase_order_items" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow_insert" ON "public"."user_permission_overrides" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow_select" ON "public"."break_entries" FOR SELECT USING (true);



CREATE POLICY "allow_select" ON "public"."campaign_recipients" FOR SELECT USING (true);



CREATE POLICY "allow_select" ON "public"."cash_drawer_events" FOR SELECT USING (true);



CREATE POLICY "allow_select" ON "public"."customer_addresses" FOR SELECT USING (true);



CREATE POLICY "allow_select" ON "public"."gift_card_transactions" FOR SELECT USING (true);



CREATE POLICY "allow_select" ON "public"."menu_item_modifier_groups" FOR SELECT USING (true);



CREATE POLICY "allow_select" ON "public"."online_menu_items" FOR SELECT USING (true);



CREATE POLICY "allow_select" ON "public"."order_discounts" FOR SELECT USING (true);



CREATE POLICY "allow_select" ON "public"."order_item_modifiers" FOR SELECT USING (true);



CREATE POLICY "allow_select" ON "public"."permissions" FOR SELECT USING (true);



CREATE POLICY "allow_select" ON "public"."purchase_order_items" FOR SELECT USING (true);



CREATE POLICY "allow_select" ON "public"."role_permissions" FOR SELECT USING (true);



CREATE POLICY "allow_select" ON "public"."user_permission_overrides" FOR SELECT USING (true);



CREATE POLICY "allow_update" ON "public"."campaign_recipients" FOR UPDATE USING (true);



CREATE POLICY "allow_update" ON "public"."online_menu_items" FOR UPDATE USING (true);



CREATE POLICY "allow_update" ON "public"."order_item_modifiers" FOR UPDATE USING (true);



CREATE POLICY "allow_update" ON "public"."purchase_order_items" FOR UPDATE USING (true);



CREATE POLICY "allow_update" ON "public"."user_permission_overrides" FOR UPDATE USING (true);



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."break_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_recipients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cash_drawer_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cash_drawers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cash_tip_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catering_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catering_menus" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chargebacks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_payment_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_item_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_reconciliations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deliveries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_zones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."demo_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "demo_requests_public_insert" ON "public"."demo_requests" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."digital_menu_boards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drive_thru_cars" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drive_thru_lanes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drive_thru_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."floor_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."franchise_royalties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gift_card_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gift_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."house_account_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."house_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_waste_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kds_stations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kds_ticket_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_programs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_item_modifier_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."modifier_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."modifiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."module_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."online_menu_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."online_menus" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."online_order_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_discounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_item_modifiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_modifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_throttle_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."org_modules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_devices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_level_prices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_level_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."print_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."print_routing" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."printers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."qr_menus" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."qr_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."receipt_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scheduled_shifts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_bypass" ON "public"."accounting_integrations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."accounting_sync_log" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."audit_log" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."break_entries" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."campaign_recipients" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."campaigns" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."cash_drawer_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."cash_drawers" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."cash_tip_reports" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."catering_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."catering_menus" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."chargebacks" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."customer_addresses" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."customer_payment_methods" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."customers" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."daily_item_metrics" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."daily_metrics" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."daily_reconciliations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."deliveries" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."delivery_zones" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."digital_menu_boards" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."discounts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."drive_thru_orders" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."floor_plans" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."franchise_royalties" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."gift_card_transactions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."gift_cards" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."house_account_transactions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."house_accounts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."inventory_items" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."inventory_transactions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."kds_stations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."kds_ticket_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."locations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."loyalty_accounts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."loyalty_programs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."loyalty_transactions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."menu_categories" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."menu_item_modifier_groups" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."menu_items" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."modifier_groups" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."modifiers" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."module_migrations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."online_menu_items" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."online_menus" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."online_order_queue" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."order_discounts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."order_item_modifiers" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."order_items" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."order_modifications" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."orders" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."org_modules" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."organizations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."payment_devices" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."payments" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."permissions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."price_level_prices" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."price_level_schedules" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."price_levels" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."purchase_order_items" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."purchase_orders" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."qr_menus" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."qr_orders" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."recipes" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."reservations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."role_permissions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."schedule_templates" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."scheduled_shifts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."settlement_batches" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."shift_swap_requests" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."shifts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."staff_availability" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."surcharge_config" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."tables" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."tax_rates" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."terminals" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."time_entries" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."tip_adjustments" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."tip_config" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."tip_distributions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."user_permission_overrides" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."users" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."vendors" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bypass" ON "public"."waitlist_entries" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."settlement_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."setup_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "setup_progress_org_access" ON "public"."setup_progress" USING (("org_id" IN ( SELECT "users"."org_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



ALTER TABLE "public"."shift_marketplace" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shift_swap_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shifts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."surcharge_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tax_rates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_delete" ON "public"."customers" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."discounts" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."floor_plans" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."locations" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."menu_categories" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."menu_items" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."modifier_groups" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."modifiers" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."order_items" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."orders" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."org_modules" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."recipes" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."staff_availability" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."tables" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."tax_rates" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."terminals" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_delete" ON "public"."users" FOR DELETE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."audit_log" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."campaigns" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."cash_drawers" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."cash_tip_reports" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."catering_events" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."catering_menus" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."chargebacks" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."customer_payment_methods" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."customers" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."daily_item_metrics" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."daily_metrics" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."daily_reconciliations" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."deliveries" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."delivery_zones" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."digital_menu_boards" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."discounts" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."drive_thru_orders" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."floor_plans" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."franchise_royalties" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."gift_cards" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."house_account_transactions" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."house_accounts" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."inventory_items" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."inventory_transactions" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."kds_stations" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."kds_ticket_events" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."locations" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."loyalty_accounts" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."loyalty_programs" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."loyalty_transactions" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."menu_categories" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."menu_items" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."modifier_groups" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."modifiers" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."module_migrations" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."online_menus" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."online_order_queue" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."order_items" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."order_modifications" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."orders" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."org_modules" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."payment_devices" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."payments" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."price_level_prices" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."price_level_schedules" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."price_levels" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."purchase_orders" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."qr_menus" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."qr_orders" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."recipes" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."reservations" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."schedule_templates" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."scheduled_shifts" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."settlement_batches" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."shift_swap_requests" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."shifts" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."staff_availability" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."surcharge_config" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."tables" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."tax_rates" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."terminals" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."time_entries" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."tip_adjustments" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."tip_config" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."tip_distributions" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."users" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."vendors" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_insert" ON "public"."waitlist_entries" FOR INSERT WITH CHECK (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_isolation_select" ON "public"."organizations" FOR SELECT USING (("id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_isolation_update" ON "public"."organizations" FOR UPDATE USING (("id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."audit_log" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."campaigns" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."cash_drawers" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."cash_tip_reports" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."catering_events" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."catering_menus" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."chargebacks" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."customer_payment_methods" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."customers" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."daily_item_metrics" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."daily_metrics" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."daily_reconciliations" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."deliveries" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."delivery_zones" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."digital_menu_boards" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."discounts" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."drive_thru_orders" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."floor_plans" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."franchise_royalties" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."gift_cards" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."house_account_transactions" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."house_accounts" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."inventory_items" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."inventory_transactions" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."kds_stations" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."kds_ticket_events" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."locations" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."loyalty_accounts" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."loyalty_programs" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."loyalty_transactions" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."menu_categories" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."menu_items" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."modifier_groups" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."modifiers" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."module_migrations" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."online_menus" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."online_order_queue" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."order_items" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."order_modifications" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."orders" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."org_modules" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."payment_devices" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."payments" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."price_level_prices" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."price_level_schedules" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."price_levels" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."purchase_orders" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."qr_menus" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."qr_orders" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."recipes" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."reservations" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."schedule_templates" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."scheduled_shifts" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."settlement_batches" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."shift_swap_requests" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."shifts" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."staff_availability" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."surcharge_config" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."tables" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."tax_rates" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."terminals" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."time_entries" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."tip_adjustments" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."tip_config" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."tip_distributions" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."users" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."vendors" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_select" ON "public"."waitlist_entries" FOR SELECT USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."campaigns" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."cash_drawers" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."catering_events" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."catering_menus" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."chargebacks" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."customer_payment_methods" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."customers" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."daily_item_metrics" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."daily_metrics" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."deliveries" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."delivery_zones" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."digital_menu_boards" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."discounts" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."drive_thru_orders" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."floor_plans" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."franchise_royalties" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."gift_cards" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."house_accounts" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."inventory_items" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."kds_stations" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."locations" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."loyalty_accounts" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."loyalty_programs" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."menu_categories" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."menu_items" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."modifier_groups" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."modifiers" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."online_menus" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."online_order_queue" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."order_items" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."orders" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."org_modules" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."payment_devices" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."payments" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."price_level_prices" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."price_level_schedules" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."price_levels" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."purchase_orders" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."qr_menus" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."reservations" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."schedule_templates" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."scheduled_shifts" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."shift_swap_requests" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."shifts" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."staff_availability" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."surcharge_config" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."tables" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."tax_rates" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."terminals" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."time_entries" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."tip_config" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."users" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."vendors" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



CREATE POLICY "tenant_update" ON "public"."waitlist_entries" FOR UPDATE USING (("org_id" = ((("current_setting"('request.jwt.claims'::"text", true))::json ->> 'org_id'::"text"))::"uuid"));



ALTER TABLE "public"."terminals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."time_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tip_adjustments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tip_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tip_distributions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_permission_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist_entries" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."next_order_number"("p_location_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."next_order_number"("p_location_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."next_order_number"("p_location_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."accounting_integrations" TO "anon";
GRANT ALL ON TABLE "public"."accounting_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."accounting_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."accounting_sync_log" TO "anon";
GRANT ALL ON TABLE "public"."accounting_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."accounting_sync_log" TO "service_role";



GRANT ALL ON TABLE "public"."ai_conversations" TO "anon";
GRANT ALL ON TABLE "public"."ai_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."ai_insights" TO "anon";
GRANT ALL ON TABLE "public"."ai_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_insights" TO "service_role";



GRANT ALL ON TABLE "public"."ai_predictions" TO "anon";
GRANT ALL ON TABLE "public"."ai_predictions" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_predictions" TO "service_role";



GRANT ALL ON TABLE "public"."ai_settings" TO "anon";
GRANT ALL ON TABLE "public"."ai_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_settings" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."break_entries" TO "anon";
GRANT ALL ON TABLE "public"."break_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."break_entries" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_recipients" TO "anon";
GRANT ALL ON TABLE "public"."campaign_recipients" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_recipients" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."cash_drawer_events" TO "anon";
GRANT ALL ON TABLE "public"."cash_drawer_events" TO "authenticated";
GRANT ALL ON TABLE "public"."cash_drawer_events" TO "service_role";



GRANT ALL ON TABLE "public"."cash_drawers" TO "anon";
GRANT ALL ON TABLE "public"."cash_drawers" TO "authenticated";
GRANT ALL ON TABLE "public"."cash_drawers" TO "service_role";



GRANT ALL ON TABLE "public"."cash_tip_reports" TO "anon";
GRANT ALL ON TABLE "public"."cash_tip_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."cash_tip_reports" TO "service_role";



GRANT ALL ON TABLE "public"."catering_events" TO "anon";
GRANT ALL ON TABLE "public"."catering_events" TO "authenticated";
GRANT ALL ON TABLE "public"."catering_events" TO "service_role";



GRANT ALL ON TABLE "public"."catering_menus" TO "anon";
GRANT ALL ON TABLE "public"."catering_menus" TO "authenticated";
GRANT ALL ON TABLE "public"."catering_menus" TO "service_role";



GRANT ALL ON TABLE "public"."chargebacks" TO "anon";
GRANT ALL ON TABLE "public"."chargebacks" TO "authenticated";
GRANT ALL ON TABLE "public"."chargebacks" TO "service_role";



GRANT ALL ON TABLE "public"."customer_addresses" TO "anon";
GRANT ALL ON TABLE "public"."customer_addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_addresses" TO "service_role";



GRANT ALL ON TABLE "public"."customer_payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."customer_payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."daily_item_metrics" TO "anon";
GRANT ALL ON TABLE "public"."daily_item_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_item_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."daily_metrics" TO "anon";
GRANT ALL ON TABLE "public"."daily_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."daily_reconciliations" TO "anon";
GRANT ALL ON TABLE "public"."daily_reconciliations" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_reconciliations" TO "service_role";



GRANT ALL ON TABLE "public"."deliveries" TO "anon";
GRANT ALL ON TABLE "public"."deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_zones" TO "anon";
GRANT ALL ON TABLE "public"."delivery_zones" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_zones" TO "service_role";



GRANT ALL ON TABLE "public"."demo_requests" TO "anon";
GRANT ALL ON TABLE "public"."demo_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."demo_requests" TO "service_role";



GRANT ALL ON TABLE "public"."digital_menu_boards" TO "anon";
GRANT ALL ON TABLE "public"."digital_menu_boards" TO "authenticated";
GRANT ALL ON TABLE "public"."digital_menu_boards" TO "service_role";



GRANT ALL ON TABLE "public"."discounts" TO "anon";
GRANT ALL ON TABLE "public"."discounts" TO "authenticated";
GRANT ALL ON TABLE "public"."discounts" TO "service_role";



GRANT ALL ON TABLE "public"."drive_thru_cars" TO "anon";
GRANT ALL ON TABLE "public"."drive_thru_cars" TO "authenticated";
GRANT ALL ON TABLE "public"."drive_thru_cars" TO "service_role";



GRANT ALL ON TABLE "public"."drive_thru_lanes" TO "anon";
GRANT ALL ON TABLE "public"."drive_thru_lanes" TO "authenticated";
GRANT ALL ON TABLE "public"."drive_thru_lanes" TO "service_role";



GRANT ALL ON TABLE "public"."drive_thru_orders" TO "anon";
GRANT ALL ON TABLE "public"."drive_thru_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."drive_thru_orders" TO "service_role";



GRANT ALL ON TABLE "public"."floor_plans" TO "anon";
GRANT ALL ON TABLE "public"."floor_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."floor_plans" TO "service_role";



GRANT ALL ON TABLE "public"."franchise_royalties" TO "anon";
GRANT ALL ON TABLE "public"."franchise_royalties" TO "authenticated";
GRANT ALL ON TABLE "public"."franchise_royalties" TO "service_role";



GRANT ALL ON TABLE "public"."gift_card_transactions" TO "anon";
GRANT ALL ON TABLE "public"."gift_card_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."gift_card_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."gift_cards" TO "anon";
GRANT ALL ON TABLE "public"."gift_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."gift_cards" TO "service_role";



GRANT ALL ON TABLE "public"."house_account_transactions" TO "anon";
GRANT ALL ON TABLE "public"."house_account_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."house_account_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."house_accounts" TO "anon";
GRANT ALL ON TABLE "public"."house_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."house_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_transactions" TO "anon";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_waste_log" TO "anon";
GRANT ALL ON TABLE "public"."inventory_waste_log" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_waste_log" TO "service_role";



GRANT ALL ON TABLE "public"."kds_stations" TO "anon";
GRANT ALL ON TABLE "public"."kds_stations" TO "authenticated";
GRANT ALL ON TABLE "public"."kds_stations" TO "service_role";



GRANT ALL ON TABLE "public"."kds_ticket_events" TO "anon";
GRANT ALL ON TABLE "public"."kds_ticket_events" TO "authenticated";
GRANT ALL ON TABLE "public"."kds_ticket_events" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_accounts" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_programs" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_programs" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_transactions" TO "anon";
GRANT ALL ON TABLE "public"."loyalty_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."menu_categories" TO "anon";
GRANT ALL ON TABLE "public"."menu_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_categories" TO "service_role";



GRANT ALL ON TABLE "public"."menu_item_modifier_groups" TO "anon";
GRANT ALL ON TABLE "public"."menu_item_modifier_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_item_modifier_groups" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."modifier_groups" TO "anon";
GRANT ALL ON TABLE "public"."modifier_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."modifier_groups" TO "service_role";



GRANT ALL ON TABLE "public"."modifiers" TO "anon";
GRANT ALL ON TABLE "public"."modifiers" TO "authenticated";
GRANT ALL ON TABLE "public"."modifiers" TO "service_role";



GRANT ALL ON TABLE "public"."module_migrations" TO "anon";
GRANT ALL ON TABLE "public"."module_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."module_migrations" TO "service_role";



GRANT ALL ON TABLE "public"."online_menu_items" TO "anon";
GRANT ALL ON TABLE "public"."online_menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."online_menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."online_menus" TO "anon";
GRANT ALL ON TABLE "public"."online_menus" TO "authenticated";
GRANT ALL ON TABLE "public"."online_menus" TO "service_role";



GRANT ALL ON TABLE "public"."online_order_queue" TO "anon";
GRANT ALL ON TABLE "public"."online_order_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."online_order_queue" TO "service_role";



GRANT ALL ON TABLE "public"."order_discounts" TO "anon";
GRANT ALL ON TABLE "public"."order_discounts" TO "authenticated";
GRANT ALL ON TABLE "public"."order_discounts" TO "service_role";



GRANT ALL ON TABLE "public"."order_item_modifiers" TO "anon";
GRANT ALL ON TABLE "public"."order_item_modifiers" TO "authenticated";
GRANT ALL ON TABLE "public"."order_item_modifiers" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_modifications" TO "anon";
GRANT ALL ON TABLE "public"."order_modifications" TO "authenticated";
GRANT ALL ON TABLE "public"."order_modifications" TO "service_role";



GRANT ALL ON TABLE "public"."order_throttle_config" TO "anon";
GRANT ALL ON TABLE "public"."order_throttle_config" TO "authenticated";
GRANT ALL ON TABLE "public"."order_throttle_config" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."org_modules" TO "anon";
GRANT ALL ON TABLE "public"."org_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."org_modules" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."payment_devices" TO "anon";
GRANT ALL ON TABLE "public"."payment_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_devices" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."price_level_prices" TO "anon";
GRANT ALL ON TABLE "public"."price_level_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."price_level_prices" TO "service_role";



GRANT ALL ON TABLE "public"."price_level_schedules" TO "anon";
GRANT ALL ON TABLE "public"."price_level_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."price_level_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."price_levels" TO "anon";
GRANT ALL ON TABLE "public"."price_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."price_levels" TO "service_role";



GRANT ALL ON TABLE "public"."print_queue" TO "anon";
GRANT ALL ON TABLE "public"."print_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."print_queue" TO "service_role";



GRANT ALL ON TABLE "public"."print_routing" TO "anon";
GRANT ALL ON TABLE "public"."print_routing" TO "authenticated";
GRANT ALL ON TABLE "public"."print_routing" TO "service_role";



GRANT ALL ON TABLE "public"."printers" TO "anon";
GRANT ALL ON TABLE "public"."printers" TO "authenticated";
GRANT ALL ON TABLE "public"."printers" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."qr_menus" TO "anon";
GRANT ALL ON TABLE "public"."qr_menus" TO "authenticated";
GRANT ALL ON TABLE "public"."qr_menus" TO "service_role";



GRANT ALL ON TABLE "public"."qr_orders" TO "anon";
GRANT ALL ON TABLE "public"."qr_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."qr_orders" TO "service_role";



GRANT ALL ON TABLE "public"."receipt_config" TO "anon";
GRANT ALL ON TABLE "public"."receipt_config" TO "authenticated";
GRANT ALL ON TABLE "public"."receipt_config" TO "service_role";



GRANT ALL ON TABLE "public"."recipes" TO "anon";
GRANT ALL ON TABLE "public"."recipes" TO "authenticated";
GRANT ALL ON TABLE "public"."recipes" TO "service_role";



GRANT ALL ON TABLE "public"."reservations" TO "anon";
GRANT ALL ON TABLE "public"."reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."reservations" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_templates" TO "anon";
GRANT ALL ON TABLE "public"."schedule_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_templates" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_shifts" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_shifts" TO "service_role";



GRANT ALL ON TABLE "public"."settlement_batches" TO "anon";
GRANT ALL ON TABLE "public"."settlement_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."settlement_batches" TO "service_role";



GRANT ALL ON TABLE "public"."setup_progress" TO "anon";
GRANT ALL ON TABLE "public"."setup_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."setup_progress" TO "service_role";



GRANT ALL ON TABLE "public"."shift_marketplace" TO "anon";
GRANT ALL ON TABLE "public"."shift_marketplace" TO "authenticated";
GRANT ALL ON TABLE "public"."shift_marketplace" TO "service_role";



GRANT ALL ON TABLE "public"."shift_swap_requests" TO "anon";
GRANT ALL ON TABLE "public"."shift_swap_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."shift_swap_requests" TO "service_role";



GRANT ALL ON TABLE "public"."shifts" TO "anon";
GRANT ALL ON TABLE "public"."shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."shifts" TO "service_role";



GRANT ALL ON TABLE "public"."staff_availability" TO "anon";
GRANT ALL ON TABLE "public"."staff_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_availability" TO "service_role";



GRANT ALL ON TABLE "public"."surcharge_config" TO "anon";
GRANT ALL ON TABLE "public"."surcharge_config" TO "authenticated";
GRANT ALL ON TABLE "public"."surcharge_config" TO "service_role";



GRANT ALL ON TABLE "public"."tables" TO "anon";
GRANT ALL ON TABLE "public"."tables" TO "authenticated";
GRANT ALL ON TABLE "public"."tables" TO "service_role";



GRANT ALL ON TABLE "public"."tax_rates" TO "anon";
GRANT ALL ON TABLE "public"."tax_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."tax_rates" TO "service_role";



GRANT ALL ON TABLE "public"."terminals" TO "anon";
GRANT ALL ON TABLE "public"."terminals" TO "authenticated";
GRANT ALL ON TABLE "public"."terminals" TO "service_role";



GRANT ALL ON TABLE "public"."time_entries" TO "anon";
GRANT ALL ON TABLE "public"."time_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."time_entries" TO "service_role";



GRANT ALL ON TABLE "public"."tip_adjustments" TO "anon";
GRANT ALL ON TABLE "public"."tip_adjustments" TO "authenticated";
GRANT ALL ON TABLE "public"."tip_adjustments" TO "service_role";



GRANT ALL ON TABLE "public"."tip_config" TO "anon";
GRANT ALL ON TABLE "public"."tip_config" TO "authenticated";
GRANT ALL ON TABLE "public"."tip_config" TO "service_role";



GRANT ALL ON TABLE "public"."tip_distributions" TO "anon";
GRANT ALL ON TABLE "public"."tip_distributions" TO "authenticated";
GRANT ALL ON TABLE "public"."tip_distributions" TO "service_role";



GRANT ALL ON TABLE "public"."user_permission_overrides" TO "anon";
GRANT ALL ON TABLE "public"."user_permission_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."user_permission_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist_entries" TO "anon";
GRANT ALL ON TABLE "public"."waitlist_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist_entries" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







