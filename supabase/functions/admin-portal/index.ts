import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getServiceKey(): string | undefined {
  const legacyServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyServiceKey && legacyServiceKey.startsWith("eyJ")) {
    return legacyServiceKey;
  }
  const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeysRaw) {
    try {
      const parsed = JSON.parse(secretKeysRaw);
      if (parsed?.default) return String(parsed.default);
    } catch {
      // Ignore parse errors and fall back
    }
  }
  return legacyServiceKey;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecodeToString(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (input.length % 4)) % 4);
  return atob(padded);
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signAdminToken(username: string, secret: string): Promise<string> {
  const payload = {
    sub: username,
    role: "admin",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const payloadB64 = base64UrlEncode(payloadBytes);
  const key = await getHmacKey(secret);
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const sigB64 = base64UrlEncode(new Uint8Array(sigBuf));
  return `${payloadB64}.${sigB64}`;
}

async function verifyAdminToken(token: string, secret: string): Promise<{ sub: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64, sigB64] = parts;
    const key = await getHmacKey(secret);
    const sigBin = atob(sigB64.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (sigB64.length % 4)) % 4));
    const sigBytes = new Uint8Array(sigBin.length);
    for (let i = 0; i < sigBin.length; i++) sigBytes[i] = sigBin.charCodeAt(i);

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecodeToString(payloadB64));
    if (!payload?.sub || payload.role !== "admin") return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { sub: String(payload.sub) };
  } catch {
    return null;
  }
}

async function anonymizeUserRef(userId: string | null | undefined, salt: string): Promise<string> {
  if (!userId) return "CIT-ANON";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${userId}`)
  );
  const bytes = new Uint8Array(digest);
  const hex = Array.from(bytes.slice(0, 3))
    .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
    .join("");
  return `CIT-${hex}`;
}

function decodeBase64Image(base64Raw: string): Uint8Array {
  const cleaned = base64Raw.includes(",") ? base64Raw.split(",")[1] : base64Raw;
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function inferDepartment(category: string): string {
  switch (category) {
    case "Roads":
      return "GNIDA · Road Maintenance & Engineering";
    case "Water":
      return "GNIDA · Water & Drainage Works";
    case "Waste":
      return "GNIDA · Sanitation & Solid Waste";
    case "Street lighting":
      return "GNIDA · Electrical & Streetlight Cell";
    default:
      return "GNIDA · Civic Operations Desk";
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return respond({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = getServiceKey();
    if (!supabaseUrl || !serviceKey) {
      return respond({ error: "Supabase service configuration missing." }, 500);
    }

    const tokenSecret = Deno.env.get("ADMIN_JWT_SECRET") || serviceKey;
    const expectedUser = Deno.env.get("ADMIN_USERNAME") || "admin01";
    const expectedPass = Deno.env.get("ADMIN_PASSWORD") || "001122";

    const body = await req.json();
    const action = String(body?.action || "").trim();

    if (action === "login") {
      const username = String(body?.username || "").trim();
      const password = String(body?.password || "");
      if (username !== expectedUser || password !== expectedPass) {
        return respond({ error: "Invalid admin ID or password." }, 401);
      }
      const token = await signAdminToken(username, tokenSecret);
      return respond({
        ok: true,
        token,
        admin: {
          username,
          displayName: "Admin Desk",
          role: "Civic Command Officer",
        },
      });
    }

    const adminToken =
      req.headers.get("x-admin-token") ||
      String(body?.token || "").trim();

    if (!adminToken) {
      return respond({ error: "Admin session token required." }, 401);
    }

    const session = await verifyAdminToken(adminToken, tokenSecret);
    if (!session) {
      return respond({ error: "Admin session expired or invalid. Please log in again." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (action === "dashboard_data") {
      const { data: reports, error: reportsError } = await admin
        .from("reports")
        .select(
          "id, report_number, user_id, title, description, category, severity, status, latitude, longitude, location_source, locality, city, state, photo_path, resolution_photo_path, resolution_note, resolved_at, resolved_by, sla_deadline_at, resolved_on_time, authenticity_verdict, authenticity_note, authenticity_reviewed_at, ai_status, community_status, groundtruth_status, confirm_count, dispute_count, verification_count, evidence_count, created_at, updated_at"
        )
        .order("created_at", { ascending: false })
        .limit(300);

      if (reportsError) throw reportsError;

      const reportList = Array.isArray(reports) ? reports : [];
      const reportIds = reportList.map((r) => r.id);
      const userIds = Array.from(new Set(reportList.map((r) => r.user_id).filter(Boolean)));

      // Fetch ONLY anonymous trust stats from citizen_profiles (never full_name/phone/email)
      const trustMap = new Map<string, { trust_score: number; true_reports_count: number; fake_reports_count: number }>();
      if (userIds.length > 0) {
        const { data: profiles } = await admin
          .from("citizen_profiles")
          .select("user_id, trust_score, true_reports_count, fake_reports_count")
          .in("user_id", userIds);

        if (Array.isArray(profiles)) {
          for (const p of profiles) {
            trustMap.set(p.user_id, {
              trust_score: Number(p.trust_score ?? 75),
              true_reports_count: Number(p.true_reports_count ?? 0),
              fake_reports_count: Number(p.fake_reports_count ?? 0),
            });
          }
        }
      }

      // Fetch latest GroundTruth AI assessment per report
      const latestAiMap = new Map<string, Record<string, unknown>>();
      if (reportIds.length > 0) {
        const { data: assessments } = await admin
          .from("groundtruth_assessments")
          .select("id, report_id, verdict, confidence_score, evidence_quality, is_sufficient_evidence, summary, observations, provider, model_name, created_at")
          .in("report_id", reportIds)
          .order("created_at", { ascending: false });

        if (Array.isArray(assessments)) {
          for (const a of assessments) {
            if (!latestAiMap.has(a.report_id)) {
              latestAiMap.set(a.report_id, a);
            }
          }
        }
      }

      // Fetch additional citizen/repair evidence per report
      const evidenceByReport = new Map<string, Array<Record<string, unknown>>>();
      const extraEvidencePaths: string[] = [];
      if (reportIds.length > 0) {
        const { data: evRows } = await admin
          .from("report_evidence")
          .select("id, report_id, photo_path, note, evidence_role, created_at")
          .in("report_id", reportIds)
          .order("created_at", { ascending: false });

        if (Array.isArray(evRows)) {
          for (const ev of evRows) {
            if (ev.photo_path) extraEvidencePaths.push(ev.photo_path);
            const list = evidenceByReport.get(ev.report_id) || [];
            list.push(ev);
            evidenceByReport.set(ev.report_id, list);
          }
        }
      }

      // Sign photo URLs in batch
      const allPhotoPaths = Array.from(
        new Set(
          [
            ...reportList.flatMap((r) => [r.photo_path, r.resolution_photo_path]),
            ...extraEvidencePaths,
          ].filter((p): p is string => Boolean(p && String(p).trim()))
        )
      );

      const signedUrlMap = new Map<string, string>();
      if (allPhotoPaths.length > 0) {
        const { data: signedList } = await admin.storage
          .from("report-evidence")
          .createSignedUrls(allPhotoPaths, 3600);

        if (Array.isArray(signedList)) {
          for (const item of signedList) {
            if (item?.path && item?.signedUrl) {
              signedUrlMap.set(item.path, item.signedUrl);
            }
          }
        }
      }

      // Build sanitized reports with zero PII
      const sanitizedReports = await Promise.all(
        reportList.map(async (r) => {
          const reporterStats = trustMap.get(r.user_id) || {
            trust_score: 75,
            true_reports_count: 0,
            fake_reports_count: 0,
          };
          const reporterRef = await anonymizeUserRef(r.user_id, tokenSecret);

          return {
            id: r.id,
            report_number: r.report_number,
            title: r.title,
            description: r.description,
            category: r.category,
            department: inferDepartment(r.category),
            severity: r.severity,
            status: r.status,
            latitude: r.latitude,
            longitude: r.longitude,
            location_source: r.location_source,
            locality: r.locality,
            city: r.city,
            state: r.state,
            photo_path: r.photo_path,
            photo_url: r.photo_path ? signedUrlMap.get(r.photo_path) || null : null,
            resolution_photo_path: r.resolution_photo_path,
            resolution_photo_url: r.resolution_photo_path
              ? signedUrlMap.get(r.resolution_photo_path) || null
              : null,
            resolution_note: r.resolution_note,
            resolved_at: r.resolved_at,
            resolved_by: r.resolved_by,
            sla_deadline_at: r.sla_deadline_at,
            resolved_on_time: r.resolved_on_time,
            authenticity_verdict: r.authenticity_verdict || "unverified",
            authenticity_note: r.authenticity_note,
            authenticity_reviewed_at: r.authenticity_reviewed_at,
            ai_status: r.ai_status,
            community_status: r.community_status,
            groundtruth_status: r.groundtruth_status,
            confirm_count: r.confirm_count || 0,
            dispute_count: r.dispute_count || 0,
            verification_count: r.verification_count || 0,
            evidence_count: r.evidence_count || 0,
            created_at: r.created_at,
            updated_at: r.updated_at,
            reporter_ref: reporterRef,
            reporter_trust_score: reporterStats.trust_score,
            reporter_true_count: reporterStats.true_reports_count,
            reporter_fake_count: reporterStats.fake_reports_count,
            latest_assessment: latestAiMap.get(r.id) || null,
            evidence_items: (evidenceByReport.get(r.id) || []).map((ev) => ({
              id: ev.id,
              photo_path: ev.photo_path,
              photo_url: ev.photo_path ? signedUrlMap.get(String(ev.photo_path)) || null : null,
              note: ev.note,
              evidence_role: ev.evidence_role,
              created_at: ev.created_at,
            })),
          };
        })
      );

      // Authority Autho-meter
      const { data: trustMetric } = await admin
        .from("civic_trust_metrics")
        .select("*")
        .eq("id", "greater_noida")
        .maybeSingle();

      // Recent audit history (no PII)
      const { data: historyRows } = await admin
        .from("groundtruth_history")
        .select("id, report_id, actor_type, event_type, title, details, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(120);

      return respond({
        ok: true,
        reports: sanitizedReports,
        authoMeter: trustMetric || {
          id: "greater_noida",
          authority_name: "Greater Noida Civic Operations",
          authority_trust_pct: 78,
          total_resolved: 0,
          resolved_on_time_count: 0,
          resolved_late_count: 0,
          avg_resolution_hours: 0,
        },
        history: Array.isArray(historyRows) ? historyRows : [],
      });
    }

    if (action === "resolve_report") {
      const reportId = String(body?.reportId || "").trim();
      const resolutionNote = String(body?.resolutionNote || "").trim();
      const photoBase64 = body?.photoBase64 ? String(body.photoBase64) : "";
      const photoMimeType = String(body?.photoMimeType || "image/jpeg").toLowerCase();

      if (!/^[0-9a-f-]{36}$/i.test(reportId)) {
        return respond({ error: "Valid reportId is required." }, 400);
      }
      if (resolutionNote.length < 5) {
        return respond({ error: "Enter resolution details (at least 5 characters)." }, 400);
      }

      const { data: report, error: reportErr } = await admin
        .from("reports")
        .select("*")
        .eq("id", reportId)
        .maybeSingle();

      if (reportErr || !report) {
        return respond({ error: "Report not found." }, 404);
      }

      let resolutionPhotoPath: string | null = report.resolution_photo_path || null;

      if (photoBase64) {
        const bytes = decodeBase64Image(photoBase64);
        if (bytes.byteLength > 10 * 1024 * 1024) {
          return respond({ error: "Resolution photo must be 10 MB or smaller." }, 400);
        }
        const extMap: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/jpg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };
        const ext = extMap[photoMimeType] || "jpg";
        const path = `admin-resolutions/${reportId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await admin.storage
          .from("report-evidence")
          .upload(path, bytes, {
            contentType: photoMimeType.startsWith("image/") ? photoMimeType : "image/jpeg",
            upsert: false,
          });
        if (uploadErr) throw uploadErr;
        resolutionPhotoPath = path;
      }

      const now = new Date();
      const createdAt = new Date(report.created_at);
      const deadline = report.sla_deadline_at
        ? new Date(report.sla_deadline_at)
        : new Date(createdAt.getTime() + 72 * 3600 * 1000);
      const resolvedOnTime = now.getTime() <= deadline.getTime();
      const resolutionHours = Math.max(0.1, (now.getTime() - createdAt.getTime()) / (1000 * 3600));

      const { error: updateErr } = await admin
        .from("reports")
        .update({
          status: "Resolved",
          groundtruth_status: "Resolved by Authority",
          resolution_photo_path: resolutionPhotoPath,
          resolution_note: resolutionNote,
          resolved_at: now.toISOString(),
          resolved_by: session.sub,
          resolved_on_time: resolvedOnTime,
          updated_at: now.toISOString(),
        })
        .eq("id", reportId);

      if (updateErr) throw updateErr;

      if (resolutionPhotoPath) {
        await admin.from("report_evidence").insert({
          report_id: reportId,
          user_id: report.user_id,
          citizen_id: report.user_id,
          photo_path: resolutionPhotoPath,
          note: `Authority repair proof: ${resolutionNote}`,
          evidence_role: "repair_claim",
        });
      }

      // Update Authority Autho-meter
      const { data: currentMetric } = await admin
        .from("civic_trust_metrics")
        .select("*")
        .eq("id", "greater_noida")
        .maybeSingle();

      const prevTrust = Number(currentMetric?.authority_trust_pct ?? 78);
      const prevTotal = Number(currentMetric?.total_resolved ?? 0);
      const prevOnTime = Number(currentMetric?.resolved_on_time_count ?? 0);
      const prevLate = Number(currentMetric?.resolved_late_count ?? 0);
      const prevAvgHours = Number(currentMetric?.avg_resolution_hours ?? 0);

      const newTotal = prevTotal + 1;
      const newOnTime = prevOnTime + (resolvedOnTime ? 1 : 0);
      const newLate = prevLate + (resolvedOnTime ? 0 : 1);
      const newAvgHours = Number(
        (((prevAvgHours * prevTotal) + resolutionHours) / newTotal).toFixed(1)
      );
      const delta = resolvedOnTime ? 2 : -3;
      const nextTrust = clamp(prevTrust + delta, 10, 100);

      await admin.from("civic_trust_metrics").upsert({
        id: "greater_noida",
        authority_name: "Greater Noida Civic Operations",
        authority_trust_pct: nextTrust,
        total_resolved: newTotal,
        resolved_on_time_count: newOnTime,
        resolved_late_count: newLate,
        avg_resolution_hours: newAvgHours,
        updated_at: now.toISOString(),
      });

      await admin.from("groundtruth_history").insert({
        report_id: reportId,
        actor_type: "admin",
        event_type: "authority_resolved",
        title: resolvedOnTime
          ? "Resolved on time by Civic Admin"
          : "Resolved past SLA target by Civic Admin",
        details: resolutionNote,
        metadata: {
          resolved_by: session.sub,
          resolved_on_time: resolvedOnTime,
          has_resolution_photo: Boolean(resolutionPhotoPath),
          authority_trust_pct: nextTrust,
        },
      });

      await admin.from("user_notifications").insert({
        user_id: report.user_id,
        report_id: reportId,
        type: "report_resolved",
        title: `Issue #GN-${report.report_number} Resolved`,
        body: `${resolutionNote}${resolvedOnTime ? " (Resolved within target time)" : ""}`,
        resolution_photo_path: resolutionPhotoPath,
        trust_delta: 0,
      });

      return respond({
        ok: true,
        reportId,
        resolvedOnTime,
        authorityTrustPct: nextTrust,
        resolutionPhotoPath,
      });
    }

    if (action === "update_status") {
      const reportId = String(body?.reportId || "").trim();
      const nextStatus = String(body?.status || "").trim();
      const note = String(body?.note || "").trim();

      if (!/^[0-9a-f-]{36}$/i.test(reportId)) {
        return respond({ error: "Valid reportId is required." }, 400);
      }
      if (!["In Progress", "Under Review", "Submitted"].includes(nextStatus)) {
        return respond({ error: "Unsupported status transition." }, 400);
      }

      const { data: report, error: reportErr } = await admin
        .from("reports")
        .select("*")
        .eq("id", reportId)
        .maybeSingle();

      if (reportErr || !report) {
        return respond({ error: "Report not found." }, 404);
      }

      const nowIso = new Date().toISOString();
      const { error: updateErr } = await admin
        .from("reports")
        .update({
          status: nextStatus,
          groundtruth_status:
            nextStatus === "In Progress" ? "Field Team Dispatched" : "Under Authority Review",
          updated_at: nowIso,
        })
        .eq("id", reportId);

      if (updateErr) throw updateErr;

      await admin.from("groundtruth_history").insert({
        report_id: reportId,
        actor_type: "admin",
        event_type: "status_updated",
        title: `Status updated to ${nextStatus}`,
        details: note || `Admin desk updated report status to ${nextStatus}.`,
        metadata: { updated_by: session.sub, status: nextStatus },
      });

      await admin.from("user_notifications").insert({
        user_id: report.user_id,
        report_id: reportId,
        type: "report_in_progress",
        title: `Issue #GN-${report.report_number}: ${nextStatus}`,
        body:
          note ||
          (nextStatus === "In Progress"
            ? "A municipal field crew has been assigned to inspect and repair this issue."
            : `Your report status was updated to ${nextStatus}.`),
        trust_delta: 0,
      });

      return respond({ ok: true, reportId, status: nextStatus });
    }

    if (action === "verify_authenticity") {
      const reportId = String(body?.reportId || "").trim();
      const verdict = String(body?.verdict || "").trim();
      const note = String(body?.note || "").trim();

      if (!/^[0-9a-f-]{36}$/i.test(reportId)) {
        return respond({ error: "Valid reportId is required." }, 400);
      }
      if (!["true_report", "fake_report"].includes(verdict)) {
        return respond({ error: "Verdict must be true_report or fake_report." }, 400);
      }

      const { data: report, error: reportErr } = await admin
        .from("reports")
        .select("*")
        .eq("id", reportId)
        .maybeSingle();

      if (reportErr || !report) {
        return respond({ error: "Report not found." }, 404);
      }

      const isFake = verdict === "fake_report";
      const nowIso = new Date().toISOString();
      const trustDelta = isFake ? -15 : 5;

      const nextStatus = isFake
        ? "Rejected (Fake)"
        : report.status === "Rejected (Fake)"
          ? "In Review"
          : report.status;

      const { error: updateErr } = await admin
        .from("reports")
        .update({
          authenticity_verdict: verdict,
          authenticity_note:
            note ||
            (isFake
              ? "Flagged as fake/inaccurate report by Civic Admin."
              : "Verified as genuine civic report by Civic Admin."),
          authenticity_reviewed_at: nowIso,
          status: nextStatus,
          groundtruth_status: isFake ? "Flagged as Fake" : "Verified Genuine",
          updated_at: nowIso,
        })
        .eq("id", reportId);

      if (updateErr) throw updateErr;

      // Update citizen's private trust score without exposing their identity
      const { data: profile } = await admin
        .from("citizen_profiles")
        .select("user_id, trust_score, true_reports_count, fake_reports_count")
        .eq("user_id", report.user_id)
        .maybeSingle();

      let nextUserTrust = clamp(75 + trustDelta, 0, 100);
      if (profile) {
        nextUserTrust = clamp(Number(profile.trust_score ?? 75) + trustDelta, 0, 100);
        await admin
          .from("citizen_profiles")
          .update({
            trust_score: nextUserTrust,
            true_reports_count: Number(profile.true_reports_count ?? 0) + (isFake ? 0 : 1),
            fake_reports_count: Number(profile.fake_reports_count ?? 0) + (isFake ? 1 : 0),
            updated_at: nowIso,
          })
          .eq("user_id", report.user_id);
      }

      await admin.from("groundtruth_history").insert({
        report_id: reportId,
        actor_type: "admin",
        event_type: isFake ? "flagged_fake" : "verified_true",
        title: isFake ? "Admin flagged report as Fake" : "Admin verified report as Genuine",
        details:
          note ||
          (isFake
            ? "Reporter trust score decreased."
            : "Reporter trust score increased."),
        metadata: {
          verdict,
          trust_delta: trustDelta,
        },
      });

      await admin.from("user_notifications").insert({
        user_id: report.user_id,
        report_id: reportId,
        type: isFake ? "report_flagged_fake" : "report_verified_true",
        title: isFake
          ? `Report #GN-${report.report_number} Flagged as Inaccurate`
          : `Report #GN-${report.report_number} Verified Genuine`,
        body: isFake
          ? `Admin review flagged this submission as fake/invalid. Your Civic Trust score changed by ${trustDelta}% (now ${nextUserTrust}%).`
          : `Admin verified your report as authentic. Your Civic Trust score increased by +${trustDelta}% (now ${nextUserTrust}%).`,
        trust_delta: trustDelta,
      });

      return respond({
        ok: true,
        reportId,
        verdict,
        trustDelta,
        reporterTrustScore: nextUserTrust,
      });
    }

    if (action === "ai_assist") {
      const reportId = body?.reportId ? String(body.reportId).trim() : null;
      const customPrompt = String(body?.prompt || "").trim();

      let targetReport: Record<string, unknown> | null = null;
      if (reportId && /^[0-9a-f-]{36}$/i.test(reportId)) {
        const { data } = await admin
          .from("reports")
          .select("id, report_number, title, description, category, severity, status, locality, city, confirm_count, dispute_count, authenticity_verdict, sla_deadline_at, created_at")
          .eq("id", reportId)
          .maybeSingle();
        targetReport = data;
      }

      const { data: pendingQueue } = await admin
        .from("reports")
        .select("id, report_number, title, category, severity, status, locality, sla_deadline_at, created_at")
        .neq("status", "Resolved")
        .order("created_at", { ascending: false })
        .limit(15);

      const geminiKey = Deno.env.get("GEMINI_API_KEY");
      if (geminiKey) {
        try {
          const prompt = [
            "You are the NagrikAI Admin Operations Co-Pilot for Greater Noida civic authorities.",
            "Give concise, practical operational advice. Never reveal or ask for citizen PII.",
            targetReport ? `Selected report: ${JSON.stringify(targetReport)}` : "No single report selected; summarize queue priorities.",
            `Pending queue snapshot (${Array.isArray(pendingQueue) ? pendingQueue.length : 0} open): ${JSON.stringify(pendingQueue || [])}`,
            customPrompt ? `Admin question: ${customPrompt}` : "Provide: 1) Priority & SLA risk, 2) Authenticity signals to check, 3) Recommended department action, 4) Short draft resolution note for the citizen.",
          ].join("\n\n");

          const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3 },
              }),
            }
          );

          if (res.ok) {
            const json = await res.json();
            const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (reply) {
              return respond({
                ok: true,
                provider: "gemini",
                reply,
              });
            }
          }
        } catch {
          // Fall back to deterministic triage below
        }
      }

      // Deterministic operational co-pilot fallback
      const queue = Array.isArray(pendingQueue) ? pendingQueue : [];
      const highPriority = queue.filter((r) => r.severity === "High");
      let reply = "";
      if (targetReport) {
        const dept = inferDepartment(String(targetReport.category || "Other"));
        const deadline = targetReport.sla_deadline_at
          ? new Date(String(targetReport.sla_deadline_at))
          : null;
        const hoursLeft = deadline
          ? Math.round((deadline.getTime() - Date.now()) / (1000 * 3600))
          : 48;
        const slaStatus =
          hoursLeft < 0
            ? `OVERDUE by ${Math.abs(hoursLeft)}h — resolving quickly limits further Autho-meter trust drop.`
            : `${hoursLeft}h remaining before SLA deadline — resolving now boosts Autho-meter trust +2%.`;

        reply = [
          `**Triage Summary — #GN-${targetReport.report_number}**`,
          `• **Assigned Desk:** ${dept}`,
          `• **SLA Status:** ${slaStatus}`,
          `• **Community Signals:** ${targetReport.confirm_count || 0} confirmed vs ${targetReport.dispute_count || 0} disputed.`,
          "",
          `**Recommended Action:** Dispatch field crew to ${targetReport.locality || targetReport.city || "pinned GPS spot"}, capture an after-repair photo, and submit via *Issue Fixed* so the citizen receives proof.`,
          "",
          `**Draft Resolution Note:** "Field team inspected and repaired the ${String(targetReport.category || "civic").toLowerCase()} issue reported at ${targetReport.locality || "your pinned location"}. After-repair photo is attached for transparency."`,
        ].join("\n");
      } else {
        reply = [
          `**Queue Triage Snapshot (${queue.length} open reports)**`,
          `• **High-severity urgent items:** ${highPriority.length}`,
          highPriority.length > 0
            ? `• **Top urgent report:** #GN-${highPriority[0].report_number} — ${highPriority[0].title} (${highPriority[0].locality || "Greater Noida"})`
            : "• No critical High-severity backlog right now.",
          "• Prioritize reports nearing their 24h/72h SLA window to raise the city Autho-meter.",
        ].join("\n");
      }

      return respond({
        ok: true,
        provider: "nagrik-triage",
        reply,
      });
    }

    return respond({ error: "Unknown action." }, 400);
  } catch (err) {
    console.error("admin-portal error:", err);
    const errMsg =
      err instanceof Error
        ? err.message
        : err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unexpected server error.";
    return respond({ error: errMsg }, 500);
  }
});
