-- 001_init_schema.sql
-- Core schema for HANU Dormitory Management System (8 tables)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. System Configuration (Singleton row id = 1)
CREATE TABLE IF NOT EXISTS public.system_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_portal_open BOOLEAN NOT NULL DEFAULT FALSE,
  open_at TIMESTAMPTZ,
  close_at TIMESTAMPTZ,
  announcement TEXT NOT NULL DEFAULT '',
  dynamic_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.system_config (id, is_portal_open, announcement, dynamic_fields)
VALUES (1, FALSE, '', '[]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. Registration Waves
CREATE TABLE IF NOT EXISTS public.registration_waves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure at most one wave is active at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_registration_waves_single_active
  ON public.registration_waves (is_active)
  WHERE is_active = TRUE;

-- 3. Buildings / Blocks
CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Amenities
CREATE TABLE IF NOT EXISTS public.amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'check'
);

-- 5. Rooms
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  floor INTEGER NOT NULL,
  room_code TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  current_count INTEGER NOT NULL DEFAULT 0 CHECK (current_count >= 0),
  price NUMERIC(12, 0) NOT NULL DEFAULT 0 CHECK (price >= 0),
  gender_type TEXT NOT NULL DEFAULT 'EMPTY' CHECK (gender_type IN ('EMPTY', 'MALE', 'FEMALE')),
  fixed_gender TEXT NULL CHECK (fixed_gender IN ('MALE', 'FEMALE')),
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_filter
  ON public.rooms (building_id, is_locked, gender_type);

-- 6. Room Amenities (Junction table)
CREATE TABLE IF NOT EXISTS public.room_amenities (
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  amenity_id UUID NOT NULL REFERENCES public.amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (room_id, amenity_id)
);

CREATE INDEX IF NOT EXISTS idx_room_amenities_amenity
  ON public.room_amenities (amenity_id);

-- 7. Registrations
CREATE TABLE IF NOT EXISTS public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wave_id UUID NOT NULL REFERENCES public.registration_waves(id) ON DELETE RESTRICT,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  student_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('MALE', 'FEMALE')),
  dob DATE NOT NULL,
  extra_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CHECKED_OUT')),
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- v2.1 Fix: Global unique constraint for active/pending students across all waves
CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_active_student
  ON public.registrations (student_code)
  WHERE status IN ('PENDING', 'APPROVED');

CREATE INDEX IF NOT EXISTS idx_registrations_room_status
  ON public.registrations (room_id, status);

CREATE INDEX IF NOT EXISTS idx_registrations_wave_status
  ON public.registrations (wave_id, status);

-- 8. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL DEFAULT 'SYSTEM',
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created
  ON public.audit_logs (action, created_at DESC);
