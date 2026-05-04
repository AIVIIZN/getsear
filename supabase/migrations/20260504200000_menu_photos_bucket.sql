-- V6.3.1: ensure the `menu-photos` storage bucket exists for AI-generated and
-- uploaded menu item photos. Public-read; service_role writes via the admin
-- client (server-side routes only). Safe to run repeatedly.

INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-photos', 'menu-photos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- RLS policies on storage.objects: read-public, write-service-role-only.
-- Drop any existing same-named policies first to remain idempotent.
DROP POLICY IF EXISTS "menu_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "menu_photos_service_role_write" ON storage.objects;
DROP POLICY IF EXISTS "menu_photos_service_role_update" ON storage.objects;
DROP POLICY IF EXISTS "menu_photos_service_role_delete" ON storage.objects;

CREATE POLICY "menu_photos_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'menu-photos');

CREATE POLICY "menu_photos_service_role_write"
  ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'menu-photos');

CREATE POLICY "menu_photos_service_role_update"
  ON storage.objects
  FOR UPDATE
  TO service_role
  USING (bucket_id = 'menu-photos')
  WITH CHECK (bucket_id = 'menu-photos');

CREATE POLICY "menu_photos_service_role_delete"
  ON storage.objects
  FOR DELETE
  TO service_role
  USING (bucket_id = 'menu-photos');
