-- 002_rpc_functions.sql
-- Atomic PostgreSQL RPC Functions for Dormitory Management System

-- Helper: Recalculate room counts & gender_type across all waves (PENDING + APPROVED)
CREATE OR REPLACE FUNCTION public.recalculate_room_counts()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rooms r
  SET
    current_count = COALESCE(stats.cnt, 0),
    gender_type = CASE
      WHEN r.fixed_gender IS NOT NULL THEN r.fixed_gender
      WHEN COALESCE(stats.cnt, 0) = 0 THEN 'EMPTY'
      ELSE COALESCE(stats.first_gender, 'EMPTY')
    END
  FROM (
    SELECT
      rm.id AS room_id,
      COUNT(reg.id)::INTEGER AS cnt,
      MIN(reg.gender) AS first_gender
    FROM public.rooms rm
    LEFT JOIN public.registrations reg
      ON reg.room_id = rm.id
      AND reg.status IN ('PENDING', 'APPROVED')
    GROUP BY rm.id
  ) stats
  WHERE r.id = stats.room_id;
END;
$$;

-- 1. Student Public Registration (Called ONLY via Next.js API with service_role)
CREATE OR REPLACE FUNCTION public.register_dorm_room(
  p_room_id UUID,
  p_student_code TEXT,
  p_full_name TEXT,
  p_gender TEXT,
  p_dob DATE,
  p_extra_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config RECORD;
  v_wave_id UUID;
  v_room RECORD;
  v_student_code TEXT;
  v_full_name TEXT;
  v_reg_id UUID;
BEGIN
  v_student_code := UPPER(TRIM(COALESCE(p_student_code, '')));
  v_full_name := TRIM(COALESCE(p_full_name, ''));

  IF v_student_code = '' OR v_full_name = '' OR p_gender NOT IN ('MALE', 'FEMALE') OR p_dob IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT');
  END IF;

  -- Check portal open & schedule
  SELECT * INTO v_config FROM public.system_config WHERE id = 1;
  IF NOT FOUND OR NOT v_config.is_portal_open THEN
    RETURN jsonb_build_object('success', false, 'error', 'PORTAL_CLOSED');
  END IF;
  IF v_config.open_at IS NOT NULL AND NOW() < v_config.open_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'PORTAL_CLOSED');
  END IF;
  IF v_config.close_at IS NOT NULL AND NOW() > v_config.close_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'PORTAL_CLOSED');
  END IF;

  -- Check active wave
  SELECT id INTO v_wave_id FROM public.registration_waves WHERE is_active = TRUE LIMIT 1;
  IF v_wave_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_ACTIVE_WAVE');
  END IF;

  -- Lock target room row (FOR UPDATE)
  SELECT r.*, b.is_locked AS building_locked
  INTO v_room
  FROM public.rooms r
  JOIN public.buildings b ON b.id = r.building_id
  WHERE r.id = p_room_id
  FOR UPDATE OF r;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ROOM_NOT_FOUND');
  END IF;

  IF v_room.building_locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'BUILDING_LOCKED');
  END IF;

  IF v_room.is_locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'ROOM_LOCKED');
  END IF;

  -- Check duplicate student globally across PENDING/APPROVED
  IF EXISTS (
    SELECT 1 FROM public.registrations
    WHERE student_code = v_student_code AND status IN ('PENDING', 'APPROVED')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_STUDENT');
  END IF;

  -- Check room capacity (also handles capacity = 0)
  IF v_room.current_count >= v_room.capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'ROOM_FULL');
  END IF;

  -- Check gender compatibility
  IF (v_room.fixed_gender IS NOT NULL AND v_room.fixed_gender <> p_gender)
     OR (v_room.gender_type <> 'EMPTY' AND v_room.gender_type <> p_gender) THEN
    RETURN jsonb_build_object('success', false, 'error', 'GENDER_MISMATCH');
  END IF;

  -- Insert registration
  INSERT INTO public.registrations (
    wave_id, room_id, student_code, full_name, gender, dob, extra_data, status
  ) VALUES (
    v_wave_id, p_room_id, v_student_code, v_full_name, p_gender, p_dob, COALESCE(p_extra_data, '{}'::jsonb), 'PENDING'
  )
  RETURNING id INTO v_reg_id;

  -- Update room count & dynamic gender_type
  UPDATE public.rooms
  SET
    current_count = current_count + 1,
    gender_type = CASE
      WHEN fixed_gender IS NOT NULL THEN fixed_gender
      WHEN gender_type = 'EMPTY' THEN p_gender
      ELSE gender_type
    END
  WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_reg_id,
    'room_code', v_room.room_code,
    'status', 'PENDING'
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_STUDENT');
END;
$$;

-- 2. Public Registration Lookup (Called ONLY via Next.js API with service_role)
CREATE OR REPLACE FUNCTION public.lookup_registration(
  p_student_code TEXT,
  p_dob DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  SELECT
    reg.id,
    reg.student_code,
    reg.full_name,
    reg.gender,
    reg.dob,
    reg.status,
    reg.reject_reason,
    reg.extra_data,
    reg.created_at,
    r.room_code,
    r.floor,
    r.price,
    b.code AS building_code,
    b.name AS building_name,
    w.name AS wave_name
  INTO v_rec
  FROM public.registrations reg
  JOIN public.rooms r ON r.id = reg.room_id
  JOIN public.buildings b ON b.id = r.building_id
  JOIN public.registration_waves w ON w.id = reg.wave_id
  WHERE reg.student_code = UPPER(TRIM(COALESCE(p_student_code, '')))
    AND reg.dob = p_dob
  ORDER BY reg.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'registration', to_jsonb(v_rec)
  );
END;
$$;

-- 3. Admin: Update Registration Status
CREATE OR REPLACE FUNCTION public.admin_update_registration_status(
  p_reg_id UUID,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg RECORD;
  v_room RECORD;
  v_actor TEXT;
  v_new_count INTEGER;
BEGIN
  IF p_new_status NOT IN ('PENDING', 'APPROVED', 'REJECTED', 'CHECKED_OUT') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS');
  END IF;

  v_actor := COALESCE(auth.jwt() ->> 'email', 'ADMIN');

  SELECT * INTO v_reg FROM public.registrations WHERE id = p_reg_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_reg.status = p_new_status THEN
    RETURN jsonb_build_object('success', true, 'unchanged', true);
  END IF;

  SELECT * INTO v_room FROM public.rooms WHERE id = v_reg.room_id FOR UPDATE;

  UPDATE public.registrations
  SET
    status = p_new_status,
    reject_reason = CASE WHEN p_new_status = 'REJECTED' THEN p_reason ELSE reject_reason END,
    updated_at = NOW()
  WHERE id = p_reg_id;

  -- Adjust room count if transitioning between active (PENDING/APPROVED) and inactive (REJECTED/CHECKED_OUT)
  IF v_reg.status IN ('PENDING', 'APPROVED') AND p_new_status IN ('REJECTED', 'CHECKED_OUT') THEN
    v_new_count := GREATEST(v_room.current_count - 1, 0);
    UPDATE public.rooms
    SET
      current_count = v_new_count,
      gender_type = CASE
        WHEN fixed_gender IS NOT NULL THEN fixed_gender
        WHEN v_new_count = 0 THEN 'EMPTY'
        ELSE gender_type
      END
    WHERE id = v_room.id;
  ELSIF v_reg.status IN ('REJECTED', 'CHECKED_OUT') AND p_new_status IN ('PENDING', 'APPROVED') THEN
    UPDATE public.rooms
    SET
      current_count = current_count + 1,
      gender_type = CASE
        WHEN fixed_gender IS NOT NULL THEN fixed_gender
        WHEN gender_type = 'EMPTY' THEN v_reg.gender
        ELSE gender_type
      END
    WHERE id = v_room.id;
  END IF;

  INSERT INTO public.audit_logs (actor, action, target_type, target_id, details)
  VALUES (
    v_actor,
    'UPDATE_REG_STATUS',
    'registration',
    p_reg_id,
    jsonb_build_object(
      'student_code', v_reg.student_code,
      'room_code', v_room.room_code,
      'from_status', v_reg.status,
      'to_status', p_new_status,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Admin: Transfer Student Atomically (Deadlock-safe lock order by id ASC)
CREATE OR REPLACE FUNCTION public.admin_transfer_student(
  p_reg_id UUID,
  p_target_room_id UUID,
  p_allow_override BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg RECORD;
  v_src_room RECORD;
  v_dst_room RECORD;
  v_first_id UUID;
  v_second_id UUID;
  v_actor TEXT;
  v_src_new_count INTEGER;
BEGIN
  v_actor := COALESCE(auth.jwt() ->> 'email', 'ADMIN');

  SELECT * INTO v_reg FROM public.registrations WHERE id = p_reg_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  END IF;

  IF v_reg.status NOT IN ('PENDING', 'APPROVED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_REG_STATUS');
  END IF;

  IF v_reg.room_id = p_target_room_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'SAME_ROOM');
  END IF;

  -- Lock both rooms in ascending UUID order to prevent deadlocks
  IF v_reg.room_id < p_target_room_id THEN
    v_first_id := v_reg.room_id;
    v_second_id := p_target_room_id;
  ELSE
    v_first_id := p_target_room_id;
    v_second_id := v_reg.room_id;
  END IF;

  PERFORM 1 FROM public.rooms WHERE id = v_first_id FOR UPDATE;
  PERFORM 1 FROM public.rooms WHERE id = v_second_id FOR UPDATE;

  SELECT * INTO v_src_room FROM public.rooms WHERE id = v_reg.room_id;
  SELECT * INTO v_dst_room FROM public.rooms WHERE id = p_target_room_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'TARGET_ROOM_NOT_FOUND');
  END IF;

  IF NOT p_allow_override THEN
    IF v_dst_room.current_count >= v_dst_room.capacity THEN
      RETURN jsonb_build_object('success', false, 'error', 'TARGET_ROOM_FULL');
    END IF;
    IF (v_dst_room.fixed_gender IS NOT NULL AND v_dst_room.fixed_gender <> v_reg.gender)
       OR (v_dst_room.gender_type <> 'EMPTY' AND v_dst_room.gender_type <> v_reg.gender) THEN
      RETURN jsonb_build_object('success', false, 'error', 'GENDER_MISMATCH');
    END IF;
  END IF;

  -- Decrement source room
  v_src_new_count := GREATEST(v_src_room.current_count - 1, 0);
  UPDATE public.rooms
  SET
    current_count = v_src_new_count,
    gender_type = CASE
      WHEN fixed_gender IS NOT NULL THEN fixed_gender
      WHEN v_src_new_count = 0 THEN 'EMPTY'
      ELSE gender_type
    END
  WHERE id = v_src_room.id;

  -- Increment destination room
  UPDATE public.rooms
  SET
    current_count = current_count + 1,
    gender_type = CASE
      WHEN fixed_gender IS NOT NULL THEN fixed_gender
      WHEN gender_type = 'EMPTY' THEN v_reg.gender
      ELSE gender_type
    END
  WHERE id = v_dst_room.id;

  -- Update registration
  UPDATE public.registrations
  SET room_id = p_target_room_id, updated_at = NOW()
  WHERE id = p_reg_id;

  INSERT INTO public.audit_logs (actor, action, target_type, target_id, details)
  VALUES (
    v_actor,
    CASE WHEN p_allow_override THEN 'TRANSFER_ROOM_OVERRIDE' ELSE 'TRANSFER_ROOM' END,
    'registration',
    p_reg_id,
    jsonb_build_object(
      'student_code', v_reg.student_code,
      'from_room', v_src_room.room_code,
      'to_room', v_dst_room.room_code,
      'override', p_allow_override
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Admin: Add Student Manually (Supports capacity/gender override)
CREATE OR REPLACE FUNCTION public.admin_add_student_manual(
  p_room_id UUID,
  p_wave_id UUID,
  p_student_code TEXT,
  p_full_name TEXT,
  p_gender TEXT,
  p_dob DATE,
  p_extra_data JSONB DEFAULT '{}'::jsonb,
  p_allow_override BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room RECORD;
  v_student_code TEXT;
  v_reg_id UUID;
  v_actor TEXT;
BEGIN
  v_actor := COALESCE(auth.jwt() ->> 'email', 'ADMIN');
  v_student_code := UPPER(TRIM(COALESCE(p_student_code, '')));

  IF v_student_code = '' OR TRIM(COALESCE(p_full_name, '')) = '' OR p_gender NOT IN ('MALE', 'FEMALE') OR p_dob IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_INPUT');
  END IF;

  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ROOM_NOT_FOUND');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.registrations
    WHERE student_code = v_student_code AND status IN ('PENDING', 'APPROVED')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_STUDENT');
  END IF;

  IF NOT p_allow_override THEN
    IF v_room.current_count >= v_room.capacity THEN
      RETURN jsonb_build_object('success', false, 'error', 'ROOM_FULL');
    END IF;
    IF (v_room.fixed_gender IS NOT NULL AND v_room.fixed_gender <> p_gender)
       OR (v_room.gender_type <> 'EMPTY' AND v_room.gender_type <> p_gender) THEN
      RETURN jsonb_build_object('success', false, 'error', 'GENDER_MISMATCH');
    END IF;
  END IF;

  INSERT INTO public.registrations (
    wave_id, room_id, student_code, full_name, gender, dob, extra_data, status
  ) VALUES (
    p_wave_id, p_room_id, v_student_code, TRIM(p_full_name), p_gender, p_dob, COALESCE(p_extra_data, '{}'::jsonb), 'APPROVED'
  )
  RETURNING id INTO v_reg_id;

  UPDATE public.rooms
  SET
    current_count = current_count + 1,
    gender_type = CASE
      WHEN fixed_gender IS NOT NULL THEN fixed_gender
      WHEN gender_type = 'EMPTY' THEN p_gender
      ELSE gender_type
    END
  WHERE id = p_room_id;

  INSERT INTO public.audit_logs (actor, action, target_type, target_id, details)
  VALUES (
    v_actor,
    CASE WHEN p_allow_override THEN 'OVERRIDE_CAPACITY' ELSE 'ADD_STUDENT_MANUAL' END,
    'registration',
    v_reg_id,
    jsonb_build_object(
      'student_code', v_student_code,
      'room_code', v_room.room_code,
      'override', p_allow_override
    )
  );

  RETURN jsonb_build_object('success', true, 'registration_id', v_reg_id);
END;
$$;

-- 6. Admin: Bulk Checkout Entire Wave (End of Academic Year)
CREATE OR REPLACE FUNCTION public.admin_checkout_wave(p_wave_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affected INTEGER;
  v_actor TEXT;
BEGIN
  v_actor := COALESCE(auth.jwt() ->> 'email', 'ADMIN');

  UPDATE public.registrations
  SET status = 'CHECKED_OUT', updated_at = NOW()
  WHERE wave_id = p_wave_id AND status IN ('PENDING', 'APPROVED');

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  PERFORM public.recalculate_room_counts();

  INSERT INTO public.audit_logs (actor, action, target_type, target_id, details)
  VALUES (
    v_actor,
    'CHECKOUT_WAVE',
    'registration_wave',
    p_wave_id,
    jsonb_build_object('checked_out_count', v_affected)
  );

  RETURN jsonb_build_object('success', true, 'checked_out_count', v_affected);
END;
$$;

-- 7. Admin: Activate Registration Wave (Atomically deactivates previous wave)
CREATE OR REPLACE FUNCTION public.activate_wave(p_wave_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor TEXT;
BEGIN
  v_actor := COALESCE(auth.jwt() ->> 'email', 'ADMIN');

  IF NOT EXISTS (SELECT 1 FROM public.registration_waves WHERE id = p_wave_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'WAVE_NOT_FOUND');
  END IF;

  UPDATE public.registration_waves SET is_active = FALSE WHERE is_active = TRUE;
  UPDATE public.registration_waves SET is_active = TRUE WHERE id = p_wave_id;

  INSERT INTO public.audit_logs (actor, action, target_type, target_id, details)
  VALUES (v_actor, 'ACTIVATE_WAVE', 'registration_wave', p_wave_id, '{}'::jsonb);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. Admin: Batch Import Students (Up to 100 rows per call)
CREATE OR REPLACE FUNCTION public.batch_import_students(p_records JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_idx INTEGER := 0;
  v_room_id UUID;
  v_wave_id UUID;
  v_student_code TEXT;
  v_full_name TEXT;
  v_gender TEXT;
  v_dob DATE;
  v_results JSONB := '[]'::jsonb;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_actor TEXT;
BEGIN
  IF jsonb_typeof(p_records) <> 'array' OR jsonb_array_length(p_records) > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'MAX_100_RECORDS_PER_BATCH');
  END IF;

  v_actor := COALESCE(auth.jwt() ->> 'email', 'ADMIN');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    v_idx := v_idx + 1;
    BEGIN
      v_student_code := UPPER(TRIM(COALESCE(v_item ->> 'student_code', '')));
      v_full_name := TRIM(COALESCE(v_item ->> 'full_name', ''));
      v_gender := UPPER(TRIM(COALESCE(v_item ->> 'gender', '')));
      v_dob := (v_item ->> 'dob')::DATE;
      v_wave_id := (v_item ->> 'wave_id')::UUID;

      SELECT id INTO v_room_id FROM public.rooms WHERE room_code = TRIM(COALESCE(v_item ->> 'room_code', ''));
      IF v_room_id IS NULL THEN
        RAISE EXCEPTION 'ROOM_NOT_FOUND';
      END IF;

      IF v_student_code = '' OR v_full_name = '' OR v_gender NOT IN ('MALE', 'FEMALE') THEN
        RAISE EXCEPTION 'INVALID_FIELDS';
      END IF;

      INSERT INTO public.registrations (
        wave_id, room_id, student_code, full_name, gender, dob, extra_data, status
      ) VALUES (
        v_wave_id, v_room_id, v_student_code, v_full_name, v_gender, v_dob,
        COALESCE(v_item -> 'extra_data', '{}'::jsonb), 'APPROVED'
      );

      v_success_count := v_success_count + 1;
      v_results := v_results || jsonb_build_object('row', v_idx, 'student_code', v_student_code, 'ok', true);
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      v_results := v_results || jsonb_build_object('row', v_idx, 'student_code', v_student_code, 'ok', false, 'error', SQLERRM);
    END;
  END LOOP;

  PERFORM public.recalculate_room_counts();

  INSERT INTO public.audit_logs (actor, action, target_type, details)
  VALUES (
    v_actor,
    'IMPORT_BATCH',
    'registration',
    jsonb_build_object('success_count', v_success_count, 'error_count', v_error_count)
  );

  RETURN jsonb_build_object(
    'success', true,
    'success_count', v_success_count,
    'error_count', v_error_count,
    'results', v_results
  );
END;
$$;
