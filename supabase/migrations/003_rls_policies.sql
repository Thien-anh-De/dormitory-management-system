-- 003_rls_policies.sql
-- Row Level Security (RLS), Table Grants & RPC Execution Permissions

-- 0. Grant schema & table privileges (required when tables are created via SQL Editor)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.system_config, public.registration_waves, public.buildings,
  public.amenities, public.rooms, public.room_amenities TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.system_config, public.registration_waves, public.buildings,
  public.amenities, public.rooms, public.room_amenities, public.registrations
TO authenticated;

GRANT SELECT ON public.audit_logs TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;

-- 1. Enable RLS on all 8 tables
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_waves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Public (anon) read-only access to non-sensitive tables
DROP POLICY IF EXISTS "anon_read_system_config" ON public.system_config;
CREATE POLICY "anon_read_system_config" ON public.system_config FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_waves" ON public.registration_waves;
CREATE POLICY "anon_read_waves" ON public.registration_waves FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_buildings" ON public.buildings;
CREATE POLICY "anon_read_buildings" ON public.buildings FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_amenities" ON public.amenities;
CREATE POLICY "anon_read_amenities" ON public.amenities FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_rooms" ON public.rooms;
CREATE POLICY "anon_read_rooms" ON public.rooms FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_room_amenities" ON public.room_amenities;
CREATE POLICY "anon_read_room_amenities" ON public.room_amenities FOR SELECT TO anon USING (true);

-- Note: anon has NO policies on `registrations` or `audit_logs` -> completely blocked.

-- 3. Authenticated (Single Admin) full access to business tables
DROP POLICY IF EXISTS "admin_all_system_config" ON public.system_config;
CREATE POLICY "admin_all_system_config" ON public.system_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_waves" ON public.registration_waves;
CREATE POLICY "admin_all_waves" ON public.registration_waves FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_buildings" ON public.buildings;
CREATE POLICY "admin_all_buildings" ON public.buildings FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_amenities" ON public.amenities;
CREATE POLICY "admin_all_amenities" ON public.amenities FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_rooms" ON public.rooms;
CREATE POLICY "admin_all_rooms" ON public.rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_room_amenities" ON public.room_amenities;
CREATE POLICY "admin_all_room_amenities" ON public.room_amenities FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_all_registrations" ON public.registrations;
CREATE POLICY "admin_all_registrations" ON public.registrations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Admin can only READ audit_logs (immutable log: no UPDATE/DELETE/manual INSERT)
DROP POLICY IF EXISTS "admin_read_audit_logs" ON public.audit_logs;
CREATE POLICY "admin_read_audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (true);

-- 4. Lock down public RPC functions so bots CANNOT bypass Cloudflare Turnstile
REVOKE EXECUTE ON FUNCTION public.register_dorm_room(UUID, TEXT, TEXT, TEXT, DATE, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_dorm_room(UUID, TEXT, TEXT, TEXT, DATE, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.lookup_registration(TEXT, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_registration(TEXT, DATE) TO service_role;

-- 5. Lock down Admin RPC functions to authenticated & service_role only
REVOKE EXECUTE ON FUNCTION public.admin_update_registration_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_registration_status(UUID, TEXT, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_transfer_student(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_transfer_student(UUID, UUID, BOOLEAN) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_add_student_manual(UUID, UUID, TEXT, TEXT, TEXT, DATE, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_student_manual(UUID, UUID, TEXT, TEXT, TEXT, DATE, JSONB, BOOLEAN) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_checkout_wave(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_checkout_wave(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.activate_wave(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_wave(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.batch_import_students(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.batch_import_students(JSONB) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.recalculate_room_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_room_counts() TO authenticated, service_role;
