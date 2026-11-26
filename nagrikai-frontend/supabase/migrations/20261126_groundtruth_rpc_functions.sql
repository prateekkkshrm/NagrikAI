-- =============================================================================
-- NagrikAI – GroundTruth Schema, Triggers, Storage & RPC Functions
-- Idempotent migration safe for fresh or existing Supabase projects.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Ensure GroundTruth columns and indexes on reports & report_evidence
-- ---------------------------------------------------------------------------
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS citizen_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS location_source TEXT NOT NULL DEFAULT 'gps';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS ai_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS community_status TEXT NOT NULL DEFAULT 'awaiting_verification';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS groundtruth_status TEXT NOT NULL DEFAULT 'Pending Review';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS confirm_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS dispute_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS verification_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS evidence_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.reports SET citizen_id = user_id WHERE citizen_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_reports_user_created ON public.reports (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_category_status ON public.reports (category, status);
CREATE INDEX IF NOT EXISTS idx_reports_lat_lng ON public.reports (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_reports_groundtruth ON public.reports (community_status, created_at DESC);

ALTER TABLE public.report_evidence ADD COLUMN IF NOT EXISTS citizen_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.report_evidence ADD COLUMN IF NOT EXISTS evidence_role TEXT NOT NULL DEFAULT 'supporting';
UPDATE public.report_evidence SET citizen_id = user_id WHERE citizen_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_report_evidence_report_id ON public.report_evidence (report_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. GroundTruth AI Assessments (written by Edge Function / service_role only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.groundtruth_assessments (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id              UUID        NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  evidence_id            UUID        REFERENCES public.report_evidence(id) ON DELETE SET NULL,
  assessment_type        TEXT        NOT NULL DEFAULT 'initial_submission'
    CHECK (assessment_type IN ('initial_submission', 'repair_check', 'corroboration_recheck')),
  provider               TEXT        NOT NULL,
  model_name             TEXT,
  verdict                TEXT        NOT NULL
    CHECK (verdict IN (
      'consistent_with_report',
      'needs_human_review',
      'insufficient_evidence',
      'repair_likely',
      'repair_uncertain',
      'assessment_unavailable'
    )),
  confidence_score       INTEGER     CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 100)),
  evidence_quality       TEXT        NOT NULL DEFAULT 'unknown'
    CHECK (evidence_quality IN ('clear', 'partial', 'insufficient', 'missing', 'unknown')),
  location_consistency   TEXT        NOT NULL DEFAULT 'unverified',
  is_sufficient_evidence BOOLEAN     NOT NULL DEFAULT false,
  summary                TEXT        NOT NULL,
  observations           JSONB       NOT NULL DEFAULT '[]'::jsonb,
  disclaimer             TEXT        NOT NULL DEFAULT 'AI assessment is advisory only and never serves as proof of authenticity or official certification.',
  raw_status             TEXT        NOT NULL DEFAULT 'completed'
    CHECK (raw_status IN ('completed', 'insufficient_evidence', 'failed', 'unavailable')),
  error_message          TEXT,
  created_by             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gt_assessments_report_created
  ON public.groundtruth_assessments (report_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. GroundTruth Community Verifications (one vote per citizen per report)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.groundtruth_verifications (
  id                  UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           UUID             NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  citizen_id          UUID             NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote                TEXT             NOT NULL CHECK (vote IN ('confirm', 'dispute')),
  comment             TEXT,
  evidence_photo_path TEXT,
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  distance_m          DOUBLE PRECISION,
  created_at          TIMESTAMPTZ      NOT NULL DEFAULT now(),
  CONSTRAINT uq_groundtruth_verification_report_citizen UNIQUE (report_id, citizen_id)
);

CREATE INDEX IF NOT EXISTS idx_gt_verifications_report_created
  ON public.groundtruth_verifications (report_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. GroundTruth Verification History (chronological audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.groundtruth_history (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID        NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  actor_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT        NOT NULL CHECK (actor_type IN ('citizen', 'community', 'ai', 'system')),
  event_type TEXT        NOT NULL,
  title      TEXT        NOT NULL,
  details    TEXT,
  metadata   JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gt_history_report_created
  ON public.groundtruth_history (report_id, created_at ASC);

-- ---------------------------------------------------------------------------
-- 5. Triggers to maintain integrity and verification history
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_report_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND current_user = 'authenticated' THEN
    new.user_id := auth.uid();
    new.citizen_id := auth.uid();
    new.ai_status := 'pending';
    new.community_status := CASE
      WHEN new.photo_path IS NULL OR trim(new.photo_path) = '' THEN 'insufficient_evidence'
      ELSE 'awaiting_verification'
    END;
    new.groundtruth_status := 'Pending Review';
    new.confirm_count := 0;
    new.dispute_count := 0;
    new.verification_count := 0;
    new.evidence_count := CASE WHEN new.photo_path IS NOT NULL AND trim(new.photo_path) <> '' THEN 1 ELSE 0 END;
    new.status := 'Submitted';
  ELSE
    new.citizen_id := coalesce(new.citizen_id, new.user_id);
  END IF;
  new.updated_at := now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_before_insert ON public.reports;
CREATE TRIGGER trg_reports_before_insert
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.sync_report_before_insert();

CREATE OR REPLACE FUNCTION public.protect_report_server_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    new.user_id := old.user_id;
    new.citizen_id := old.citizen_id;
    new.report_number := old.report_number;
    new.ai_status := old.ai_status;
    new.community_status := old.community_status;
    new.groundtruth_status := old.groundtruth_status;
    new.confirm_count := old.confirm_count;
    new.dispute_count := old.dispute_count;
    new.verification_count := old.verification_count;
    new.evidence_count := old.evidence_count;
  END IF;
  new.updated_at := now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_before_update ON public.reports;
CREATE TRIGGER trg_reports_before_update
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.protect_report_server_fields();

CREATE OR REPLACE FUNCTION public.log_report_created_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.groundtruth_history (
    report_id, actor_id, actor_type, event_type, title, details, metadata
  ) VALUES (
    new.id,
    new.user_id,
    'citizen',
    'report_submitted',
    'Civic report submitted',
    format('Report #GN-%s logged under %s (%s severity).', new.report_number, new.category, new.severity),
    jsonb_build_object(
      'category', new.category,
      'severity', new.severity,
      'location_source', new.location_source,
      'has_photo', (new.photo_path IS NOT NULL AND trim(new.photo_path) <> '')
    )
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_after_insert ON public.reports;
CREATE TRIGGER trg_reports_after_insert
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.log_report_created_history();

CREATE OR REPLACE FUNCTION public.sync_evidence_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND current_user = 'authenticated' THEN
    new.user_id := auth.uid();
    new.citizen_id := auth.uid();
  ELSE
    new.citizen_id := coalesce(new.citizen_id, new.user_id);
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_evidence_before_insert ON public.report_evidence;
CREATE TRIGGER trg_report_evidence_before_insert
  BEFORE INSERT ON public.report_evidence
  FOR EACH ROW EXECUTE FUNCTION public.sync_evidence_before_insert();

CREATE OR REPLACE FUNCTION public.on_report_evidence_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reports
  SET evidence_count = coalesce(evidence_count, 0) + 1,
      updated_at = now()
  WHERE id = new.report_id;

  INSERT INTO public.groundtruth_history (
    report_id, actor_id, actor_type, event_type, title, details, metadata
  ) VALUES (
    new.report_id,
    new.user_id,
    'community',
    'supporting_evidence_added',
    'Supporting photographic evidence added',
    coalesce(nullif(trim(new.note), ''), 'Citizen uploaded additional on-ground photographic evidence.'),
    jsonb_build_object('evidence_id', new.id, 'evidence_role', new.evidence_role)
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_evidence_after_insert ON public.report_evidence;
CREATE TRIGGER trg_report_evidence_after_insert
  AFTER INSERT ON public.report_evidence
  FOR EACH ROW EXECUTE FUNCTION public.on_report_evidence_added();

-- ---------------------------------------------------------------------------
-- 6. Row Level Security Policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groundtruth_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groundtruth_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groundtruth_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gt_assessments_select_authenticated" ON public.groundtruth_assessments;
CREATE POLICY "gt_assessments_select_authenticated"
  ON public.groundtruth_assessments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "gt_verifications_select_authenticated" ON public.groundtruth_verifications;
CREATE POLICY "gt_verifications_select_authenticated"
  ON public.groundtruth_verifications FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "gt_verifications_insert_own" ON public.groundtruth_verifications;
CREATE POLICY "gt_verifications_insert_own"
  ON public.groundtruth_verifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = citizen_id);

DROP POLICY IF EXISTS "gt_history_select_authenticated" ON public.groundtruth_history;
CREATE POLICY "gt_history_select_authenticated"
  ON public.groundtruth_history FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 7. Helper distance function (Haversine in metres)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.haversine_distance_m(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371000.0 * 2.0 * asin(
    sqrt(
      least(
        1.0,
        power(sin(radians((lat2 - lat1) / 2.0)), 2) +
        cos(radians(lat1)) * cos(radians(lat2)) *
        power(sin(radians((lng2 - lng1) / 2.0)), 2)
      )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.haversine_distance_m(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. RPC: get_nearby_groundtruth_reports
--    Matches groundtruthService.js: (p_lat, p_lng, p_radius_m, p_limit)
--    and GroundTruthScreens.jsx fields (latest_ai_*, my_vote, distance_m, etc.)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_nearby_groundtruth_reports(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_nearby_groundtruth_reports(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER);

CREATE OR REPLACE FUNCTION public.get_nearby_groundtruth_reports(
  p_lat      DOUBLE PRECISION DEFAULT NULL,
  p_lng      DOUBLE PRECISION DEFAULT NULL,
  p_radius_m DOUBLE PRECISION DEFAULT 15000.0,
  p_limit    INTEGER          DEFAULT 30
)
RETURNS TABLE (
  id                      UUID,
  report_number           BIGINT,
  citizen_id              UUID,
  title                   TEXT,
  description             TEXT,
  category                TEXT,
  severity                TEXT,
  status                  TEXT,
  latitude                DOUBLE PRECISION,
  longitude               DOUBLE PRECISION,
  location_source         TEXT,
  locality                TEXT,
  city                    TEXT,
  state                   TEXT,
  photo_path              TEXT,
  ai_status               TEXT,
  community_status        TEXT,
  groundtruth_status      TEXT,
  confirm_count           INTEGER,
  dispute_count           INTEGER,
  verification_count      INTEGER,
  evidence_count          INTEGER,
  distance_m              DOUBLE PRECISION,
  my_vote                 TEXT,
  latest_ai_verdict       TEXT,
  latest_ai_confidence    INTEGER,
  latest_ai_summary       TEXT,
  latest_ai_provider      TEXT,
  latest_ai_is_sufficient BOOLEAN,
  latest_ai_created_at    TIMESTAMPTZ,
  created_at              TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.report_number,
    coalesce(r.citizen_id, r.user_id) AS citizen_id,
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
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND r.latitude IS NOT NULL AND r.longitude IS NOT NULL
        THEN public.haversine_distance_m(p_lat, p_lng, r.latitude, r.longitude)
      ELSE NULL
    END AS distance_m,
    v.vote AS my_vote,
    a.verdict AS latest_ai_verdict,
    a.confidence_score AS latest_ai_confidence,
    a.summary AS latest_ai_summary,
    a.provider AS latest_ai_provider,
    a.is_sufficient_evidence AS latest_ai_is_sufficient,
    a.created_at AS latest_ai_created_at,
    r.created_at
  FROM public.reports r
  LEFT JOIN public.groundtruth_verifications v
    ON v.report_id = r.id AND v.citizen_id = v_uid
  LEFT JOIN LATERAL (
    SELECT ga.verdict, ga.confidence_score, ga.summary, ga.provider, ga.is_sufficient_evidence, ga.created_at
    FROM public.groundtruth_assessments ga
    WHERE ga.report_id = r.id
    ORDER BY ga.created_at DESC
    LIMIT 1
  ) a ON true
  WHERE (
    p_lat IS NULL OR p_lng IS NULL
    OR (
      r.latitude IS NOT NULL AND r.longitude IS NOT NULL
      AND public.haversine_distance_m(p_lat, p_lng, r.latitude, r.longitude) <= coalesce(p_radius_m, 15000.0)
    )
  )
  ORDER BY
    CASE WHEN r.community_status IN ('conflicting', 'awaiting_verification', 'in_review') THEN 0 ELSE 1 END ASC,
    coalesce(
      CASE
        WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND r.latitude IS NOT NULL AND r.longitude IS NOT NULL
          THEN public.haversine_distance_m(p_lat, p_lng, r.latitude, r.longitude)
        ELSE NULL
      END,
      99999999.0
    ) ASC,
    r.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 30), 100));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_groundtruth_reports(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. RPC: submit_groundtruth_verification
--    Atomic 1-vote-per-citizen community verification with supporting evidence
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.submit_groundtruth_verification(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION);

CREATE OR REPLACE FUNCTION public.submit_groundtruth_verification(
  p_report_id           UUID,
  p_vote                TEXT,
  p_comment             TEXT             DEFAULT NULL,
  p_evidence_photo_path TEXT             DEFAULT NULL,
  p_lat                 DOUBLE PRECISION DEFAULT NULL,
  p_lng                 DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid              UUID := auth.uid();
  v_report           public.reports%ROWTYPE;
  v_distance_m       DOUBLE PRECISION;
  v_confirm          INTEGER;
  v_dispute          INTEGER;
  v_total            INTEGER;
  v_community_status TEXT;
  v_gt_status        TEXT;
  v_report_status    TEXT;
  v_clean_comment    TEXT;
  v_verification_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_vote NOT IN ('confirm', 'dispute') THEN
    RAISE EXCEPTION 'Vote must be confirm or dispute.';
  END IF;

  SELECT * INTO v_report FROM public.reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.groundtruth_verifications
    WHERE report_id = p_report_id AND citizen_id = v_uid
  ) THEN
    RAISE EXCEPTION 'You have already submitted a verification vote for this report.';
  END IF;

  v_clean_comment := nullif(trim(coalesce(p_comment, '')), '');

  IF p_lat IS NOT NULL AND p_lng IS NOT NULL AND v_report.latitude IS NOT NULL AND v_report.longitude IS NOT NULL THEN
    v_distance_m := public.haversine_distance_m(p_lat, p_lng, v_report.latitude, v_report.longitude);
  ELSE
    v_distance_m := NULL;
  END IF;

  INSERT INTO public.groundtruth_verifications (
    report_id, citizen_id, vote, comment, evidence_photo_path, latitude, longitude, distance_m
  ) VALUES (
    p_report_id, v_uid, p_vote, v_clean_comment, nullif(trim(coalesce(p_evidence_photo_path, '')), ''), p_lat, p_lng, v_distance_m
  )
  RETURNING id INTO v_verification_id;

  IF p_evidence_photo_path IS NOT NULL AND trim(p_evidence_photo_path) <> '' THEN
    INSERT INTO public.report_evidence (
      report_id, user_id, citizen_id, photo_path, note, evidence_role
    ) VALUES (
      p_report_id, v_uid, v_uid, trim(p_evidence_photo_path),
      coalesce(v_clean_comment, format('Supporting evidence submitted during GroundTruth %s.', p_vote)),
      'on_site_check'
    );
  END IF;

  SELECT
    count(*) FILTER (WHERE vote = 'confirm')::integer,
    count(*) FILTER (WHERE vote = 'dispute')::integer
  INTO v_confirm, v_dispute
  FROM public.groundtruth_verifications
  WHERE report_id = p_report_id;

  v_total := v_confirm + v_dispute;

  IF v_total = 0 THEN
    v_community_status := CASE
      WHEN v_report.photo_path IS NULL OR trim(v_report.photo_path) = '' THEN 'insufficient_evidence'
      ELSE 'awaiting_verification'
    END;
    v_gt_status := 'Pending Review';
  ELSIF v_confirm > 0 AND v_dispute > 0 THEN
    IF least(v_confirm, v_dispute)::double precision / greatest(v_confirm, v_dispute)::double precision >= 0.35
       OR v_confirm = v_dispute THEN
      v_community_status := 'conflicting';
      v_gt_status := 'Conflicting Community Evidence';
    ELSIF v_confirm > v_dispute * 2 AND v_confirm >= 2 THEN
      v_community_status := 'corroborated';
      v_gt_status := 'Community Corroborated';
    ELSIF v_dispute > v_confirm * 2 AND v_dispute >= 2 THEN
      v_community_status := 'disputed';
      v_gt_status := 'Disputed by Community';
    ELSE
      v_community_status := 'conflicting';
      v_gt_status := 'Conflicting Community Evidence';
    END IF;
  ELSIF v_confirm >= 2 THEN
    v_community_status := 'corroborated';
    v_gt_status := 'Community Corroborated';
  ELSIF v_dispute >= 2 THEN
    v_community_status := 'disputed';
    v_gt_status := 'Disputed by Community';
  ELSE
    v_community_status := 'in_review';
    v_gt_status := 'Community Review in Progress';
  END IF;

  v_report_status := CASE
    WHEN v_report.status = 'Resolved' THEN 'Resolved'
    WHEN v_community_status = 'corroborated' THEN 'Community Verified'
    WHEN v_community_status = 'conflicting' THEN 'Under Review'
    WHEN v_community_status = 'disputed' THEN 'Disputed'
    ELSE 'In Review'
  END;

  UPDATE public.reports
  SET confirm_count = v_confirm,
      dispute_count = v_dispute,
      verification_count = v_total,
      community_status = v_community_status,
      groundtruth_status = v_gt_status,
      status = v_report_status,
      updated_at = now()
  WHERE id = p_report_id;

  INSERT INTO public.groundtruth_history (
    report_id, actor_id, actor_type, event_type, title, details, metadata
  ) VALUES (
    p_report_id,
    v_uid,
    'community',
    CASE WHEN p_vote = 'confirm' THEN 'community_confirmed' ELSE 'community_disputed' END,
    CASE WHEN p_vote = 'confirm' THEN 'Citizen confirmed report on the ground' ELSE 'Citizen disputed report claim' END,
    coalesce(
      v_clean_comment,
      CASE WHEN p_vote = 'confirm'
        THEN 'Community member confirmed the reported issue matches on-ground conditions.'
        ELSE 'Community member flagged a discrepancy or reported the issue could not be verified.'
      END
    ),
    jsonb_build_object(
      'verification_id', v_verification_id,
      'vote', p_vote,
      'distance_m', v_distance_m,
      'confirm_count', v_confirm,
      'dispute_count', v_dispute,
      'community_status', v_community_status
    )
  );

  IF v_community_status = 'conflicting' THEN
    INSERT INTO public.groundtruth_history (
      report_id, actor_id, actor_type, event_type, title, details, metadata
    ) VALUES (
      p_report_id,
      v_uid,
      'system',
      'conflict_detected',
      'Conflicting community responses detected',
      format('%s confirmations vs %s disputes. Additional on-site evidence is required.', v_confirm, v_dispute),
      jsonb_build_object('confirm_count', v_confirm, 'dispute_count', v_dispute)
    );
  END IF;

  RETURN jsonb_build_object(
    'verification_id', v_verification_id,
    'report_id', p_report_id,
    'my_vote', p_vote,
    'confirm_count', v_confirm,
    'dispute_count', v_dispute,
    'verification_count', v_total,
    'community_status', v_community_status,
    'groundtruth_status', v_gt_status,
    'report_status', v_report_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_groundtruth_verification(UUID, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 10. RPC: get_report_groundtruth_detail
--     Returns full dossier for GroundTruthScreens.jsx & TrackingScreen
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_report_groundtruth_detail(UUID);

CREATE OR REPLACE FUNCTION public.get_report_groundtruth_detail(
  p_report_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_report        JSONB;
  v_assessments   JSONB;
  v_evidence      JSONB;
  v_verifications JSONB;
  v_history       JSONB;
  v_my_vote       TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT to_jsonb(r.*) INTO v_report
  FROM public.reports r
  WHERE r.id = p_report_id;

  IF v_report IS NULL THEN
    RAISE EXCEPTION 'Report not found.';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(a.*) ORDER BY a.created_at DESC), '[]'::jsonb)
  INTO v_assessments
  FROM public.groundtruth_assessments a
  WHERE a.report_id = p_report_id;

  SELECT coalesce(jsonb_agg(to_jsonb(e.*) ORDER BY e.created_at DESC), '[]'::jsonb)
  INTO v_evidence
  FROM public.report_evidence e
  WHERE e.report_id = p_report_id;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', v.id,
        'vote', v.vote,
        'comment', v.comment,
        'evidence_photo_path', v.evidence_photo_path,
        'distance_m', v.distance_m,
        'is_mine', (v.citizen_id = v_uid),
        'created_at', v.created_at
      )
      ORDER BY v.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_verifications
  FROM public.groundtruth_verifications v
  WHERE v.report_id = p_report_id;

  SELECT v.vote INTO v_my_vote
  FROM public.groundtruth_verifications v
  WHERE v.report_id = p_report_id AND v.citizen_id = v_uid;

  SELECT coalesce(jsonb_agg(to_jsonb(h.*) ORDER BY h.created_at ASC), '[]'::jsonb)
  INTO v_history
  FROM public.groundtruth_history h
  WHERE h.report_id = p_report_id;

  RETURN jsonb_build_object(
    'report',        v_report,
    'assessments',   v_assessments,
    'evidence',      v_evidence,
    'verifications', v_verifications,
    'history',       v_history,
    'my_vote',       v_my_vote
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_report_groundtruth_detail(UUID)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 11. Refresh PostgREST schema cache immediately
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
