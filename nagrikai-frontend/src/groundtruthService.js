import { supabase, isSupabaseConfigured } from "./supabaseClient";

export const REPORT_CATEGORIES = [
  "Roads",
  "Water",
  "Waste",
  "Street lighting",
  "Other",
];

export const REPORT_SEVERITIES = ["Low", "Medium", "High"];

export const COMMUNITY_TARGET_REVIEWS = 3;

export const AI_DISCLAIMER =
  "AI assessment is advisory only and never proves authenticity or certifies a repair. On-ground citizen verification is required.";

const signedUrlCache = new Map();

export function formatCoordinates(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "Coordinates unavailable";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function formatDistanceLabel(distanceM) {
  const num = Number(distanceM);
  if (!Number.isFinite(num)) return "Distance unavailable";
  if (num < 1000) return `${Math.round(num)} m away`;
  return `${(num / 1000).toFixed(1)} km away`;
}

export function formatShortId(uuid) {
  if (!uuid) return "N/A";
  const str = String(uuid);
  return str.length > 12 ? `${str.slice(0, 8)}...${str.slice(-4)}` : str;
}

export function formatDateTime(iso) {
  if (!iso) return "Timestamp unavailable";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return null;
  }
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function validateReportDraft({
  issue,
  description,
  category,
  severity,
  photo,
  location,
}) {
  const errors = {};
  const cleanTitle = String(issue || "").trim();
  const cleanDesc = String(description || "").trim();

  if (cleanTitle.length < 3) {
    errors.issue = "Enter at least 3 characters for the issue title.";
  } else if (cleanTitle.length > 140) {
    errors.issue = "Issue title must be 140 characters or fewer.";
  }

  if (cleanDesc.length < 10) {
    errors.description = `Describe the issue in at least 10 characters (${cleanDesc.length}/10).`;
  } else if (cleanDesc.length > 1000) {
    errors.description = "Description must be 1000 characters or fewer.";
  }

  if (!REPORT_CATEGORIES.includes(category)) {
    errors.category = "Select a valid issue category.";
  }

  if (severity && !REPORT_SEVERITIES.includes(severity)) {
    errors.severity = "Select Low, Medium, or High severity.";
  }

  if (!photo?.file) {
    errors.photo = "Attach a clear photo as evidence.";
  }

  if (!Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) {
    errors.location = "Detect GPS location or pick a location on the map.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export async function uploadEvidenceFile(file, userId) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  if (!file || !userId) {
    throw new Error("Valid image file and signed-in citizen are required.");
  }
  if (!file.type?.startsWith("image/")) {
    throw new Error("Only image files (JPEG, PNG, WEBP, HEIC) are allowed.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image must be 10 MB or smaller.");
  }

  const extensions = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  const ext = extensions[file.type.toLowerCase()] || "jpg";
  const photoPath = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("report-evidence")
    .upload(photoPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    throw uploadError;
  }

  return photoPath;
}

export async function removeEvidenceFileQuietly(photoPath) {
  if (!photoPath || !isSupabaseConfigured) return;
  try {
    await supabase.storage.from("report-evidence").remove([photoPath]);
  } catch (err) {
    console.warn("Orphaned storage cleanup skipped:", err?.message || err);
  }
}

export async function getSignedEvidenceUrl(photoPath) {
  if (!photoPath || !isSupabaseConfigured) return null;

  const cached = signedUrlCache.get(photoPath);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.url;
  }

  try {
    const { data, error } = await supabase.storage
      .from("report-evidence")
      .createSignedUrl(photoPath, 3600);

    if (error || !data?.signedUrl) {
      return null;
    }

    signedUrlCache.set(photoPath, {
      url: data.signedUrl,
      expiresAt: Date.now() + 3600 * 1000,
    });
    return data.signedUrl;
  } catch {
    return null;
  }
}

export async function triggerGroundTruthAssessment({
  reportId,
  evidenceId = null,
  assessmentType = "initial_submission",
}) {
  if (!isSupabaseConfigured || !reportId) {
    return {
      ok: false,
      assessment: null,
      error: "GroundTruth AI service unavailable.",
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke(
      "assess-groundtruth",
      {
        body: {
          reportId,
          evidenceId,
          assessmentType,
        },
      }
    );

    if (error) {
      return {
        ok: false,
        assessment: null,
        error: error.message || "AI assessment could not be completed.",
      };
    }

    return {
      ok: Boolean(data?.success),
      assessment: data?.assessment || null,
      error: data?.error || null,
    };
  } catch (err) {
    return {
      ok: false,
      assessment: null,
      error: err?.message || "AI assessment failed.",
    };
  }
}

export async function fetchNearbyGroundTruthReports({
  lat = null,
  lng = null,
  radiusM = 15000,
  limit = 30,
} = {}) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase configuration missing.");
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) throw new Error("Please sign in to access GroundTruth.");

  const { data, error } = await supabase.rpc(
    "get_nearby_groundtruth_reports",
    {
      p_lat: Number.isFinite(lat) ? lat : null,
      p_lng: Number.isFinite(lng) ? lng : null,
      p_radius_m: radiusM,
      p_limit: limit,
    }
  );

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function fetchReportGroundTruthDetail(reportId) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase configuration missing.");
  }
  if (!reportId) {
    throw new Error("Report ID is required.");
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!authData?.user) throw new Error("Please sign in to view verification details.");

  const { data, error } = await supabase.rpc(
    "get_report_groundtruth_detail",
    { p_report_id: reportId }
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function submitCommunityVerification({
  reportId,
  vote,
  comment = "",
  evidenceFile = null,
  userLocation = null,
}) {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase configuration missing.");
  }
  if (!reportId || !["confirm", "dispute"].includes(vote)) {
    throw new Error("Select Confirm or Dispute before submitting.");
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const user = authData?.user;
  if (!user) {
    throw new Error("Please sign in to participate in verification.");
  }

  let uploadedPath = null;
  if (evidenceFile) {
    uploadedPath = await uploadEvidenceFile(evidenceFile, user.id);
  }

  try {
    const { data, error } = await supabase.rpc(
      "submit_groundtruth_verification",
      {
        p_report_id: reportId,
        p_vote: vote,
        p_comment: comment?.trim() || null,
        p_evidence_photo_path: uploadedPath,
        p_lat: Number.isFinite(userLocation?.lat) ? userLocation.lat : null,
        p_lng: Number.isFinite(userLocation?.lng) ? userLocation.lng : null,
      }
    );

    if (error) {
      throw error;
    }

    return data;
  } catch (err) {
    if (uploadedPath) {
      await removeEvidenceFileQuietly(uploadedPath);
    }
    throw err;
  }
}

export async function fetchCitizenReportsWithGroundTruth() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase configuration missing.");
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const user = authData?.user;
  if (!user) throw new Error("Please sign in to view your reports.");

  const { data: reports, error: reportsError } = await supabase
    .from("reports")
    .select(
      "id, report_number, user_id, citizen_id, title, description, category, severity, status, latitude, longitude, location_source, locality, city, state, photo_path, resolution_photo_path, resolution_note, resolved_at, resolved_on_time, authenticity_verdict, authenticity_note, ai_status, community_status, groundtruth_status, confirm_count, dispute_count, verification_count, evidence_count, created_at, updated_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (reportsError) throw reportsError;

  const list = Array.isArray(reports) ? reports : [];
  if (list.length === 0) return [];

  const reportIds = list.map((r) => r.id);

  const { data: assessments } = await supabase
    .from("groundtruth_assessments")
    .select(
      "id, report_id, verdict, confidence_score, evidence_quality, is_sufficient_evidence, summary, provider, raw_status, created_at"
    )
    .in("report_id", reportIds)
    .order("created_at", { ascending: false });

  const latestAssessmentByReport = new Map();
  if (Array.isArray(assessments)) {
    for (const item of assessments) {
      if (!latestAssessmentByReport.has(item.report_id)) {
        latestAssessmentByReport.set(item.report_id, item);
      }
    }
  }

  return list.map((report) => ({
    ...report,
    latest_assessment: latestAssessmentByReport.get(report.id) || null,
  }));
}

export function getAiVerdictMeta(assessment, reportAiStatus) {
  const verdict = assessment?.verdict || (reportAiStatus === "failed" || reportAiStatus === "unavailable" ? "assessment_unavailable" : null);

  if (!assessment && (!reportAiStatus || reportAiStatus === "pending")) {
    return {
      label: "AI review pending",
      tone: "amber",
      summary: "Automated advisory review has not finished yet. Community verification can proceed independently.",
      canRetry: true,
    };
  }

  switch (verdict) {
    case "consistent_with_report":
      return {
        label: "Visually aligned with report (Advisory)",
        tone: "green",
        summary: assessment?.summary || "Submitted photo aligns visually with the described civic issue.",
        canRetry: false,
      };
    case "repair_likely":
      return {
        label: "Repair indicators observed (Advisory)",
        tone: "green",
        summary: assessment?.summary || "Latest photo shows possible repair activity; field confirmation is required.",
        canRetry: false,
      };
    case "insufficient_evidence":
      return {
        label: "Insufficient visual evidence",
        tone: "amber",
        summary: assessment?.summary || "Attached evidence is unclear or missing key context. Add clearer on-ground photos.",
        canRetry: true,
      };
    case "needs_human_review":
      return {
        label: "Needs human verification",
        tone: "amber",
        summary: assessment?.summary || "Visual cues are inconclusive. Community on-site review is required.",
        canRetry: true,
      };
    case "repair_uncertain":
      return {
        label: "Repair inconclusive",
        tone: "amber",
        summary: assessment?.summary || "AI could not determine repair completion. Citizens nearby should verify.",
        canRetry: true,
      };
    default:
      return {
        label: "AI assessment unavailable",
        tone: "muted",
        summary:
          assessment?.summary ||
          "AI review could not be completed. Your report remains saved and eligible for community verification.",
        canRetry: true,
      };
  }
}

export function getCommunityStatusMeta(report) {
  const confirmCount = Number(report?.confirm_count || 0);
  const disputeCount = Number(report?.dispute_count || 0);
  const total = Number(report?.verification_count ?? confirmCount + disputeCount);
  const hasPhoto = Boolean(report?.photo_path) || Number(report?.evidence_count || 0) > 0;
  const status = report?.community_status || "awaiting_verification";
  const progressPct = Math.min(100, Math.round((total / COMMUNITY_TARGET_REVIEWS) * 100));

  if (!hasPhoto && total === 0) {
    return {
      status: "insufficient_evidence",
      label: "Insufficient evidence",
      tone: "amber",
      progressPct: 0,
      description: "No photographic evidence is attached yet. Add a photo before corroborating.",
      isConflicting: false,
      isInsufficient: true,
    };
  }

  switch (status) {
    case "corroborated":
      return {
        status,
        label: "Community corroborated",
        tone: "green",
        progressPct: 100,
        description: `${confirmCount} citizen${confirmCount === 1 ? "" : "s"} confirmed this report on the ground.`,
        isConflicting: false,
        isInsufficient: false,
      };
    case "conflicting":
      return {
        status,
        label: "Conflicting responses",
        tone: "amber",
        progressPct,
        description: `${confirmCount} confirmed vs ${disputeCount} disputed. Additional on-site evidence is needed to resolve the conflict.`,
        isConflicting: true,
        isInsufficient: false,
      };
    case "disputed":
      return {
        status,
        label: "Disputed by community",
        tone: "danger",
        progressPct,
        description: `${disputeCount} citizen${disputeCount === 1 ? "" : "s"} disputed this report or could not verify it on site.`,
        isConflicting: false,
        isInsufficient: false,
      };
    case "in_review":
      return {
        status,
        label: "Verification in progress",
        tone: "green",
        progressPct,
        description: `${total} of ${COMMUNITY_TARGET_REVIEWS} community reviews recorded so far.`,
        isConflicting: false,
        isInsufficient: false,
      };
    case "insufficient_evidence":
      return {
        status,
        label: "Insufficient evidence",
        tone: "amber",
        progressPct,
        description: "More on-ground visual evidence is needed before verification can conclude.",
        isConflicting: false,
        isInsufficient: true,
      };
    default:
      return {
        status: "awaiting_verification",
        label: "Awaiting community verification",
        tone: "muted",
        progressPct,
        description: "No citizen verifications recorded yet. Nearby residents can confirm or dispute.",
        isConflicting: false,
        isInsufficient: false,
      };
  }
}
