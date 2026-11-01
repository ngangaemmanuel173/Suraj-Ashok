/*
# Add sub_account Column to All Data Tables

## Purpose
Add a `sub_account` text column to all operational data tables so that each
sub-account portal (mcl, tarmal, csl, pn_mashru, master) only sees its own data.
Master/admin users see data where sub_account = 'master'.

## Changes
Adds `sub_account text NOT NULL DEFAULT 'master'` to existing data tables:
- vehicles, drivers, trips, products, spare_parts, work_records, employees,
  route_rates, weighbridge_entries, clients, client_deliveries, payroll_records

Tables that already have sub_account (profiles) are skipped.
driver_compliance, vehicle_compliance, and tyre_history do not exist yet and are skipped.

## Security
- No RLS policy changes in this migration.
- The column is added with a safe default so existing rows get 'master'.
- Uses DO $$ block with IF NOT EXISTS checks + table existence check for idempotency.
*/

DO $$
DECLARE
  tbl text;
  data_tables text[] := ARRAY[
    'vehicles', 'drivers', 'trips', 'products', 'spare_parts', 'work_records',
    'employees', 'route_rates', 'weighbridge_entries', 'clients', 'client_deliveries',
    'payroll_records'
  ];
BEGIN
  FOREACH tbl IN ARRAY data_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl)
       AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'sub_account'
       ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN sub_account text NOT NULL DEFAULT %L', tbl, 'master');
    END IF;
  END LOOP;
END $$;