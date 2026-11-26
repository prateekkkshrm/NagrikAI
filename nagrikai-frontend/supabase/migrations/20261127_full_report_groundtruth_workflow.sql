-- =============================================================================
-- NagrikAI – Full Report, Gallery Location, AI Verification, Nearby Notifications,
-- and Challenge Resolution Workflow Migration
-- Idempotent migration safe for existing Supabase projects.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Extend reports table with photo/location/AI/challenge metadata
-- ---------------------------------------------------------------------------
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS photo_source TEXT NOT NULL DEFAULT 'camera';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS gallery_location_confirmed BOOLEAN;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ai_category_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ai_category_confidence INTEGER;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ai_category_reason TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS notifications_sent_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS parent_report_id UUID REFERENCES public.reports(id) ON DELETE SET NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS challenge_count INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. Extend citizen_profiles with last known coordinates for nearby alerts
-- ---------------------------------------------------------------------------
ALTER TABLE public.citizen_profiles ADD COLUMN IF NOT EXISTS last_latitude DOUBLE PRECISION;
ALTER TABLE public.citizen_profiles ADD COLUMN IF NOT EXISTS last_longitude DOUBLE PRECISION;
ALTER TABLE public.citizen_profiles ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 3. Notifications table for nearby citizen verification alerts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id                UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID             NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id         UUID             NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  notification_type TEXT             NOT NULL DEFAULT 'nearby_verify',
  title             TEXT             NOT NULL,
  body              TEXT             NOT NULL,
  distance_m        DOUBLE PRECISION,
  is_read           BOOLEAN          NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ      NOT NULL DEFAULT now(),
  CONSTRAINT uq_notifications_recipient_report_type UNIQUE (recipient_user_id, report_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications (recipient_user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);

-- ---------------------------------------------------------------------------
-- 4. Update citizen location RPC (stores coordinates for nearby alert targeting)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_citizen_location(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_lat IS NULL OR p_lng IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.citizen_profiles
  SET last_latitude = p_lat,
      last_longitude = p_lng,
      last_location_at = now(),
      updated_at = now()
  WHERE user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_citizen_location(DOUBLE PRECISION, DOUBLE PRECISION)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Trigger: Dispatch notifications to nearby users when a report is raised
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_nearby_report_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sent_count INTEGER := 0;
BEGIN
  IF new.latitude IS NULL OR new.longitude IS NULL THEN
    RETURN new;
  END IF;

  WITH nearby_users AS (
    SELECT
      cp.user_id,
      public.haversine_distance_m(new.latitude, new.longitude, cp.last_latitude, cp.last_longitude) AS dist_m
    FROM public.citizen_profiles cp
    WHERE cp.user_id IS NOT NULL
      AND cp.user_id <> new.user_id
      AND cp.last_latitude IS NOT NULL
      AND cp.last_longitude IS NOT NULL
      AND public.haversine_distance_m(new.latitude, new.longitude, cp.last_latitude, cp.last_longitude) <= 10000.0
  ),
  inserted AS (
    INSERT INTO public.notifications (
      recipient_user_id, report_id, notification_type, title, body, distance_m
    )
    SELECT
      nu.user_id,
      new.id,
      'nearby_verify',
      format('Verify nearby issue #GN-%s (%s)', new.report_number, new.category),
      format('%s — Tap to verify if this issue is real or fake (%s m away).', new.title, round(nu.dist_m)::text),
      nu.dist_m
    FROM nearby_users nu
    ON CONFLICT (recipient_user_id, report_id, notification_type) DO NOTHING
    RETURNING id
  )
  SELECT count(*)::integer INTO v_sent_count FROM inserted;

  UPDATE public.reports
  SET notifications_sent_count = coalesce(v_sent_count, 0)
  WHERE id = new.id;

  INSERT INTO public.groundtruth_history (
    report_id, actor_id, actor_type, event_type, title, details, metadata
  ) VALUES (
    new.id,
    new.user_id,
    'system',
    'nearby_notifications_dispatched',
    'Nearby citizens notified for Real/Fake check',
    format('Alerted %s nearby citizen(s) around (%s, %s) to verify this report.', coalesce(v_sent_count, 0), round(new.latitude::numeric, 4), round(new.longitude::numeric, 4)),
    jsonb_build_object(
      'notifications_sent', coalesce(v_sent_count, 0),
      'photo_source', new.photo_source,
      'gallery_location_confirmed', new.gallery_location_confirmed,
      'location_source', new.location_source,
      'ai_category_verified', new.ai_category_verified
    )
  );

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_after_insert_notify ON public.reports;
CREATE TRIGGER trg_reports_after_insert_notify
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_nearby_report_notifications();

-- ---------------------------------------------------------------------------
-- 6. RPC: challenge_resolved_report
--    Allows a citizen to challenge a Resolved report by submitting new evidence
--    under the pre-existing report through the same verification workflow.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.challenge_resolved_report(
  p_report_id                 UUID,
  p_title                     TEXT,
  p_description               TEXT,
  p_category                  TEXT,
  p_photo_path                TEXT,
  p_photo_source              TEXT             DEFAULT 'camera',
  p_gallery_location_confirmed BOOLEAN         DEFAULT NULL,
  p_location_source           TEXT             DEFAULT 'gps',
  p_lat                       DOUBLE PRECISION DEFAULT NULL,
  p_lng                       DOUBLE PRECISION DEFAULT NULL,
  p_ai_category_verified      BOOLEAN          DEFAULT false,
  p_ai_category_confidence    INTEGER          DEFAULT NULL,
  p_ai_category_reason        TEXT             DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_report      public.reports%ROWTYPE;
  v_evidence_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_report FROM public.reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent report not found.';
  END IF;

  IF p_photo_path IS NULL OR trim(p_photo_path) = '' THEN
    RAISE EXCEPTION 'Photographic evidence is required to challenge a resolution.';
  END IF;

  INSERT INTO public.report_evidence (
    report_id, user_id, citizen_id, photo_path, note, evidence_role
  ) VALUES (
    p_report_id,
    v_uid,
    v_uid,
    trim(p_photo_path),
    format('[CHALLENGE: %s] %s', coalesce(nullif(trim(p_title), ''), v_report.title), trim(p_description)),
    'challenge'
  )
  RETURNING id INTO v_evidence_id;

  UPDATE public.reports
  SET status = 'Challenged',
      groundtruth_status = 'Resolution Challenged',
      community_status = 'conflicting',
      challenge_count = coalesce(challenge_count, 0) + 1,
      updated_at = now()
  WHERE id = p_report_id;

  INSERT INTO public.groundtruth_history (
    report_id, actor_id, actor_type, event_type, title, details, metadata
  ) VALUES (
    p_report_id,
    v_uid,
    'citizen',
    'resolution_challenged',
    'Resolution challenged by citizen',
    trim(p_description),
    jsonb_build_object(
      'evidence_id', v_evidence_id,
      'challenge_title', trim(p_title),
      'category', p_category,
      'photo_source', p_photo_source,
      'gallery_location_confirmed', p_gallery_location_confirmed,
      'location_source', p_location_source,
      'latitude', p_lat,
      'longitude', p_lng,
      'ai_category_verified', p_ai_category_verified,
      'ai_category_confidence', p_ai_category_confidence,
      'ai_category_reason', p_ai_category_reason
    )
  );

  RETURN jsonb_build_object(
    'report_id', p_report_id,
    'report_number', v_report.report_number,
    'evidence_id', v_evidence_id,
    'status', 'Challenged',
    'groundtruth_status', 'Resolution Challenged'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.challenge_resolved_report(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN, INTEGER, TEXT
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Enable Realtime on reports & notifications (safe idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

NOTIFY pgrst, 'reload schema';
