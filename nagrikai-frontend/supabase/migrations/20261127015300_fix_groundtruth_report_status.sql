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

  UPDATE public.reports
  SET confirm_count = v_confirm,
      dispute_count = v_dispute,
      verification_count = v_total,
      community_status = v_community_status,
      groundtruth_status = v_gt_status,
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
    'report_status', v_report.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.challenge_resolved_report(
  p_report_id                  UUID,
  p_title                      TEXT,
  p_description                TEXT,
  p_category                   TEXT,
  p_photo_path                 TEXT,
  p_photo_source               TEXT             DEFAULT 'camera',
  p_gallery_location_confirmed BOOLEAN          DEFAULT NULL,
  p_location_source            TEXT             DEFAULT 'gps',
  p_lat                        DOUBLE PRECISION DEFAULT NULL,
  p_lng                        DOUBLE PRECISION DEFAULT NULL,
  p_ai_category_verified       BOOLEAN          DEFAULT false,
  p_ai_category_confidence     INTEGER          DEFAULT NULL,
  p_ai_category_reason         TEXT             DEFAULT NULL
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
  SET status = 'In progress',
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
    'status', 'In progress',
    'groundtruth_status', 'Resolution Challenged'
  );
END;
$$;
