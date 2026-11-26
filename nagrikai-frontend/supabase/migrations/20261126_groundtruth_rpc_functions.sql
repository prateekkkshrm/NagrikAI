-- =============================================================================
-- NagrikAI – GroundTruth RPC Functions
-- Run this entire file once in the Supabase SQL Editor (or via CLI migration)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Enable PostGIS extension (needed for earth_distance / point calculations)
--    Already enabled in most Supabase projects; safe to run again.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;
CREATE EXTENSION IF NOT EXISTS cube CASCADE;

-- ---------------------------------------------------------------------------
-- 1. community_verifications table (if it doesn't exist yet)
--    Stores every citizen confirm / dispute vote.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_verifications (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           UUID        NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote                TEXT        NOT NULL CHECK (vote IN ('confirm', 'dispute')),
  comment             TEXT,
  evidence_photo_path TEXT,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast per-report lookups
CREATE INDEX IF NOT EXISTS idx_community_verifications_report_id
  ON public.community_verifications(report_id);

-- One vote per user per report
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_verifications_user_report
  ON public.community_verifications(user_id, report_id);

-- RLS
ALTER TABLE public.community_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Citizens can read all verifications" ON public.community_verifications;
CREATE POLICY "Citizens can read all verifications"
  ON public.community_verifications FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Citizens can insert their own verification" ON public.community_verifications;
CREATE POLICY "Citizens can insert their own verification"
  ON public.community_verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. get_nearby_groundtruth_reports
--    Returns reports within p_radius_m metres of (p_lat, p_lng),
--    ordered by distance, with the latest AI assessment joined.
--    Parameters match exactly what groundtruthService.js sends:
--      p_lat, p_lng, p_radius_m, p_limit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_nearby_groundtruth_reports(
  p_lat      DOUBLE PRECISION,
  p_lng      DOUBLE PRECISION,
  p_radius_m INTEGER  DEFAULT 15000,
  p_limit    INTEGER  DEFAULT 30
)
RETURNS TABLE (
  id                   UUID,
  report_number        TEXT,
  user_id              UUID,
  citizen_id           TEXT,
  title                TEXT,
  description          TEXT,
  category             TEXT,
  severity             TEXT,
  status               TEXT,
  latitude             DOUBLE PRECISION,
  longitude            DOUBLE PRECISION,
  location_source      TEXT,
  locality             TEXT,
  city                 TEXT,
  state                TEXT,
  photo_path           TEXT,
  ai_status            TEXT,
  community_status     TEXT,
  groundtruth_status   TEXT,
  confirm_count        INTEGER,
  dispute_count        INTEGER,
  verification_count   INTEGER,
  evidence_count       INTEGER,
  created_at           TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ,
  distance_m           DOUBLE PRECISION,
  -- latest AI assessment fields
  assessment_id        UUID,
  verdict              TEXT,
  confidence_score     DOUBLE PRECISION,
  evidence_quality     TEXT,
  is_sufficient_evidence BOOLEAN,
  assessment_summary   TEXT,
  assessment_provider  TEXT,
  assessment_created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.report_number,
    r.user_id,
    r.citizen_id,
    r.title,
    r.description,
    r.category,
    r.severity,
    r.status,
    r.latitude,
    r.longitude,
    r.location_source,
    r.locality,
    r.city,
    r.state,
    r.photo_path,
    r.ai_status,
    r.community_status,
    r.groundtruth_status,
    r.confirm_count,
    r.dispute_count,
    r.verification_count,
    r.evidence_count,
    r.created_at,
    r.updated_at,
    -- Haversine distance in metres using earthdistance
    earth_distance(
      ll_to_earth(p_lat, p_lng),
      ll_to_earth(r.latitude, r.longitude)
    ) AS distance_m,
    -- Latest AI assessment (LEFT JOIN so reports with no assessment still appear)
    ga.id              AS assessment_id,
    ga.verdict,
    ga.confidence_score,
    ga.evidence_quality,
    ga.is_sufficient_evidence,
    ga.summary         AS assessment_summary,
    ga.provider        AS assessment_provider,
    ga.created_at      AS assessment_created_at
  FROM public.reports r
  LEFT JOIN LATERAL (
    SELECT *
    FROM public.groundtruth_assessments
    WHERE report_id = r.id
    ORDER BY created_at DESC
    LIMIT 1
  ) ga ON true
  WHERE
    r.latitude  IS NOT NULL
    AND r.longitude IS NOT NULL
    AND earth_distance(
          ll_to_earth(p_lat, p_lng),
          ll_to_earth(r.latitude, r.longitude)
        ) <= p_radius_m
  ORDER BY distance_m ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_groundtruth_reports(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_report_groundtruth_detail
--    Returns full detail for a single report including verifications.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_report_groundtruth_detail(
  p_report_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report      JSON;
  v_assessments JSON;
  v_verifications JSON;
BEGIN
  SELECT row_to_json(r) INTO v_report
  FROM public.reports r
  WHERE r.id = p_report_id;

  IF v_report IS NULL THEN
    RAISE EXCEPTION 'Report % not found', p_report_id;
  END IF;

  SELECT json_agg(a ORDER BY a.created_at DESC) INTO v_assessments
  FROM public.groundtruth_assessments a
  WHERE a.report_id = p_report_id;

  SELECT json_agg(cv ORDER BY cv.created_at DESC) INTO v_verifications
  FROM public.community_verifications cv
  WHERE cv.report_id = p_report_id;

  RETURN json_build_object(
    'report',         v_report,
    'assessments',    COALESCE(v_assessments, '[]'::json),
    'verifications',  COALESCE(v_verifications, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_report_groundtruth_detail(UUID)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. submit_groundtruth_verification
--    Inserts (or updates) a citizen vote and updates denormalised counters.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_groundtruth_verification(
  p_report_id          UUID,
  p_vote               TEXT,
  p_comment            TEXT    DEFAULT NULL,
  p_evidence_photo_path TEXT   DEFAULT NULL,
  p_lat                DOUBLE PRECISION DEFAULT NULL,
  p_lng                DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_ver_id     UUID;
  v_confirms   INTEGER;
  v_disputes   INTEGER;
  v_total      INTEGER;
  v_new_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_vote NOT IN ('confirm', 'dispute') THEN
    RAISE EXCEPTION 'Vote must be ''confirm'' or ''dispute''';
  END IF;

  INSERT INTO public.community_verifications (
    report_id, user_id, vote, comment, evidence_photo_path, lat, lng
  ) VALUES (
    p_report_id, v_user_id, p_vote, p_comment, p_evidence_photo_path, p_lat, p_lng
  )
  ON CONFLICT (user_id, report_id) DO UPDATE
    SET vote                = EXCLUDED.vote,
        comment             = EXCLUDED.comment,
        evidence_photo_path = COALESCE(EXCLUDED.evidence_photo_path, community_verifications.evidence_photo_path),
        lat                 = EXCLUDED.lat,
        lng                 = EXCLUDED.lng
  RETURNING id INTO v_ver_id;

  SELECT
    COUNT(*) FILTER (WHERE vote = 'confirm'),
    COUNT(*) FILTER (WHERE vote = 'dispute'),
    COUNT(*)
  INTO v_confirms, v_disputes, v_total
  FROM public.community_verifications
  WHERE report_id = p_report_id;

  v_new_status :=
    CASE
      WHEN v_confirms >= 3 AND v_confirms > v_disputes * 2  THEN 'corroborated'
      WHEN v_disputes >= 3 AND v_disputes > v_confirms * 2  THEN 'disputed'
      WHEN v_total >= 1 AND ABS(v_confirms - v_disputes) <= 1 THEN 'conflicting'
      WHEN v_total >= 1                                       THEN 'in_review'
      ELSE 'awaiting_verification'
    END;

  UPDATE public.reports
  SET
    confirm_count      = v_confirms,
    dispute_count      = v_disputes,
    verification_count = v_total,
    community_status   = v_new_status,
    updated_at         = now()
  WHERE id = p_report_id;

  RETURN json_build_object(
    'verification_id',    v_ver_id,
    'confirm_count',      v_confirms,
    'dispute_count',      v_disputes,
    'verification_count', v_total,
    'community_status',   v_new_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_groundtruth_verification(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. find_nearby_reports  (duplicate-check on report submission)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.find_nearby_reports(
  p_lat      DOUBLE PRECISION,
  p_lng      DOUBLE PRECISION,
  p_category TEXT    DEFAULT NULL,
  p_radius_m INTEGER DEFAULT 500,
  p_limit    INTEGER DEFAULT 10
)
RETURNS TABLE (
  id            UUID,
  report_number TEXT,
  title         TEXT,
  category      TEXT,
  severity      TEXT,
  status        TEXT,
  latitude      DOUBLE PRECISION,
  longitude     DOUBLE PRECISION,
  locality      TEXT,
  city          TEXT,
  created_at    TIMESTAMPTZ,
  distance_m    DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.report_number,
    r.title,
    r.category,
    r.severity,
    r.status,
    r.latitude,
    r.longitude,
    r.locality,
    r.city,
    r.created_at,
    earth_distance(
      ll_to_earth(p_lat, p_lng),
      ll_to_earth(r.latitude, r.longitude)
    ) AS distance_m
  FROM public.reports r
  WHERE
    r.latitude  IS NOT NULL
    AND r.longitude IS NOT NULL
    AND (p_category IS NULL OR r.category = p_category)
    AND earth_distance(
          ll_to_earth(p_lat, p_lng),
          ll_to_earth(r.latitude, r.longitude)
        ) <= p_radius_m
  ORDER BY distance_m ASC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.find_nearby_reports(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, INTEGER, INTEGER)
  TO authenticated;

-- =============================================================================
-- Done. All 4 functions created + community_verifications table ensured.
-- =============================================================================
