import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DISCLAIMER =
  "AI assessment is advisory only and never serves as proof of authenticity or official verification. On-ground community review is required.";

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function normalizeVerdict(
  raw: unknown,
  assessmentType: string
):
  | "consistent_with_report"
  | "needs_human_review"
  | "insufficient_evidence"
  | "repair_likely"
  | "repair_uncertain"
  | "assessment_unavailable" {
  const allowed = new Set([
    "consistent_with_report",
    "needs_human_review",
    "insufficient_evidence",
    "repair_likely",
    "repair_uncertain",
    "assessment_unavailable",
  ]);
  const v = String(raw || "").trim().toLowerCase();
  if (allowed.has(v)) {
    return v as ReturnType<typeof normalizeVerdict>;
  }
  return assessmentType === "repair_check"
    ? "repair_uncertain"
    : "needs_human_review";
}

function normalizeQuality(
  raw: unknown
): "clear" | "partial" | "insufficient" | "missing" | "unknown" {
  const v = String(raw || "").trim().toLowerCase();
  if (
    v === "clear" ||
    v === "partial" ||
    v === "insufficient" ||
    v === "missing"
  ) {
    return v;
  }
  return "unknown";
}

interface AiOutput {
  provider: string;
  modelName: string | null;
  verdict: ReturnType<typeof normalizeVerdict>;
  confidenceScore: number | null;
  evidenceQuality: ReturnType<typeof normalizeQuality>;
  locationConsistency: string;
  isSufficientEvidence: boolean;
  summary: string;
  observations: string[];
  rawStatus: "completed" | "insufficient_evidence" | "failed" | "unavailable";
  errorMessage: string | null;
}

async function runIshanEndpoint(
  endpointUrl: string,
  apiKey: string | undefined,
  payload: Record<string, unknown>
): Promise<AiOutput> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["x-api-key"] = apiKey;
    }

    const res = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`External AI service returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const confidenceRaw = Number(data.confidence_score ?? data.confidence);
    const confidenceScore =
      Number.isFinite(confidenceRaw) && confidenceRaw >= 0 && confidenceRaw <= 100
        ? Math.round(confidenceRaw)
        : null;

    const verdict = normalizeVerdict(
      data.verdict,
      String(payload.assessmentType || "initial_submission")
    );
    const evidenceQuality = normalizeQuality(data.evidence_quality);
    const isSufficient =
      typeof data.is_sufficient_evidence === "boolean"
        ? data.is_sufficient_evidence
        : verdict !== "insufficient_evidence" && evidenceQuality !== "insufficient";

    return {
      provider: "ishan-ai",
      modelName: String(data.model_name || data.model || "ishan-civic-vision"),
      verdict,
      confidenceScore,
      evidenceQuality,
      locationConsistency: String(
        data.location_consistency || "gps_metadata_attached"
      ),
      isSufficientEvidence: isSufficient,
      summary: String(
        data.summary ||
          "AI visual review completed. Human community verification is still required."
      ).slice(0, 600),
      observations: Array.isArray(data.observations)
        ? data.observations.slice(0, 6).map((x: unknown) => String(x))
        : [],
      rawStatus: isSufficient ? "completed" : "insufficient_evidence",
      errorMessage: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runGeminiVision(
  apiKey: string,
  model: string,
  report: Record<string, unknown>,
  assessmentType: string,
  imageBase64: string,
  mimeType: string
): Promise<AiOutput> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);

  try {
    const prompt = [
      "You are GroundTruth AI, an advisory civic-evidence evaluator for NagrikAI (Greater Noida, India).",
      "Analyze the attached citizen photograph alongside the report details.",
      "IMPORTANT RULES:",
      "- Never claim proof of authenticity, fraud detection certainty, or official repair certification.",
      "- If the image is blurry, dark, obstructed, unrelated to civic infrastructure, or lacks context, set verdict to 'insufficient_evidence' and is_sufficient_evidence to false.",
      "- Keep confidence_score conservative (0 to 100 integer). It measures visual alignment only, NOT authenticity.",
      "",
      `Assessment type: ${assessmentType}`,
      `Category: ${report.category}`,
      `Severity: ${report.severity}`,
      `Title: ${report.title}`,
      `Description: ${report.description}`,
      `Location: ${report.locality || "Unknown locality"}, ${report.city || "Greater Noida"} (${report.location_source || "gps"})`,
      "",
      "Return valid JSON only with keys:",
      "{",
      '  "verdict": "consistent_with_report" | "needs_human_review" | "insufficient_evidence" | "repair_likely" | "repair_uncertain",',
      '  "confidence_score": integer 0..100,',
      '  "evidence_quality": "clear" | "partial" | "insufficient",',
      '  "location_consistency": short string describing visible environmental context,',
      '  "is_sufficient_evidence": boolean,',
      '  "summary": 1-2 sentence neutral advisory summary,',
      '  "observations": array of 2-4 concise visual observations',
      "}",
    ].join("\n");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType || "image/jpeg",
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API HTTP ${res.status}: ${errText.slice(0, 160)}`);
    }

    const json = await res.json();
    const rawText =
      json?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(rawText);

    const confidenceRaw = Number(parsed.confidence_score);
    const confidenceScore =
      Number.isFinite(confidenceRaw) && confidenceRaw >= 0 && confidenceRaw <= 100
        ? Math.round(confidenceRaw)
        : 50;

    const verdict = normalizeVerdict(parsed.verdict, assessmentType);
    const evidenceQuality = normalizeQuality(parsed.evidence_quality);
    const isSufficient =
      typeof parsed.is_sufficient_evidence === "boolean"
        ? parsed.is_sufficient_evidence
        : verdict !== "insufficient_evidence" && evidenceQuality !== "insufficient";

    return {
      provider: "gemini-vision",
      modelName: model,
      verdict,
      confidenceScore,
      evidenceQuality,
      locationConsistency: String(
        parsed.location_consistency || "visual_context_reviewed"
      ).slice(0, 160),
      isSufficientEvidence: isSufficient,
      summary: String(
        parsed.summary ||
          "Visual evidence reviewed. Community corroboration is required before treating this report as verified."
      ).slice(0, 600),
      observations: Array.isArray(parsed.observations)
        ? parsed.observations.slice(0, 5).map((x: unknown) => String(x).slice(0, 180))
        : [],
      rawStatus: isSufficient ? "completed" : "insufficient_evidence",
      errorMessage: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed." }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return respond({ error: "Authentication required." }, 401);
    }

    const token = authorization.slice(7);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");
    let secretKeys: Record<string, string> = {};
    if (secretKeysRaw) {
      try {
        secretKeys = JSON.parse(secretKeysRaw);
      } catch {
        secretKeys = {};
      }
    }

    const serviceKey =
      secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
      return respond({ error: "Server configuration missing." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) {
      return respond({ error: "Invalid or expired session." }, 401);
    }

    const body = await req.json();
    const reportId = String(body.reportId || "").trim();
    const evidenceId = body.evidenceId ? String(body.evidenceId).trim() : null;
    const assessmentType = ["initial_submission", "repair_check", "corroboration_recheck"].includes(
      String(body.assessmentType || "")
    )
      ? String(body.assessmentType)
      : "initial_submission";

    if (!/^[0-9a-f-]{36}$/i.test(reportId)) {
      return respond({ error: "Valid reportId is required." }, 400);
    }

    const { data: report, error: reportError } = await admin
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .maybeSingle();

    if (reportError || !report) {
      return respond({ error: "Report not found." }, 404);
    }

    let targetPhotoPath: string | null = report.photo_path || null;
    if (evidenceId && /^[0-9a-f-]{36}$/i.test(evidenceId)) {
      const { data: ev } = await admin
        .from("report_evidence")
        .select("id, photo_path")
        .eq("id", evidenceId)
        .eq("report_id", reportId)
        .maybeSingle();
      if (ev?.photo_path) {
        targetPhotoPath = ev.photo_path;
      }
    }

    let output: AiOutput;

    if (!targetPhotoPath) {
      output = {
        provider: "fallback-rule-engine",
        modelName: "metadata-check-v1",
        verdict: "insufficient_evidence",
        confidenceScore: null,
        evidenceQuality: "missing",
        locationConsistency: "gps_only_no_image",
        isSufficientEvidence: false,
        summary:
          "No photographic evidence is attached to this report yet. On-ground citizen photos are required before assessment.",
        observations: [
          "Missing primary or supporting photograph.",
          "Location coordinates recorded; visual confirmation pending.",
        ],
        rawStatus: "insufficient_evidence",
        errorMessage: null,
      };
    } else {
      const { data: fileBlob, error: downloadError } = await admin.storage
        .from("report-evidence")
        .download(targetPhotoPath);

      if (downloadError || !fileBlob) {
        output = {
          provider: "unavailable",
          modelName: null,
          verdict: "insufficient_evidence",
          confidenceScore: null,
          evidenceQuality: "missing",
          locationConsistency: "storage_unreadable",
          isSufficientEvidence: false,
          summary:
            "Attached evidence file could not be retrieved for automated review. Community on-ground verification remains open.",
          observations: ["Evidence retrieval failed; report remains saved."],
          rawStatus: "unavailable",
          errorMessage: downloadError?.message || "Storage download failed.",
        };
      } else {
        const buffer = await fileBlob.arrayBuffer();
        const mimeType = fileBlob.type || "image/jpeg";
        const imageBase64 = arrayBufferToBase64(buffer);

        const ishanUrl = Deno.env.get("ISHAN_AI_URL");
        const ishanKey = Deno.env.get("ISHAN_AI_API_KEY");
        const geminiKey = Deno.env.get("GEMINI_API_KEY");
        const geminiModel =
          Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

        try {
          if (ishanUrl) {
            const { data: signed } = await admin.storage
              .from("report-evidence")
              .createSignedUrl(targetPhotoPath, 300);

            output = await runIshanEndpoint(ishanUrl, ishanKey, {
              reportId,
              assessmentType,
              title: report.title,
              description: report.description,
              category: report.category,
              severity: report.severity,
              latitude: report.latitude,
              longitude: report.longitude,
              locality: report.locality,
              imageUrl: signed?.signedUrl || null,
              imageBase64,
              mimeType,
            });
          } else if (geminiKey) {
            output = await runGeminiVision(
              geminiKey,
              geminiModel,
              report,
              assessmentType,
              imageBase64,
              mimeType
            );
          } else {
            const hasDetails =
              String(report.description || "").trim().length >= 10 &&
              Number.isFinite(Number(report.latitude)) &&
              Number.isFinite(Number(report.longitude)) &&
              buffer.byteLength > 2048;

            output = {
              provider: "fallback-rule-engine",
              modelName: "metadata-check-v1",
              verdict: hasDetails
                ? "needs_human_review"
                : "insufficient_evidence",
              confidenceScore: null,
              evidenceQuality: hasDetails ? "partial" : "insufficient",
              locationConsistency:
                report.location_source === "manual_adjusted"
                  ? "citizen_adjusted_coordinates"
                  : "gps_coordinates_attached",
              isSufficientEvidence: hasDetails,
              summary: hasDetails
                ? "Photo evidence, description, and coordinates were recorded. Live vision AI scoring is not configured on this environment yet, so community on-ground review is required."
                : "Evidence appears incomplete for automated review. Please attach a clear photo and detailed description.",
              observations: [
                `Image received (${Math.round(buffer.byteLength / 1024)} KB, ${mimeType}).`,
                `Location source: ${report.location_source === "manual_adjusted" ? "Citizen-adjusted pin" : "Device GPS"}.`,
                "AI confidence withheld until vision model is active.",
              ],
              rawStatus: hasDetails ? "unavailable" : "insufficient_evidence",
              errorMessage: null,
            };
          }
        } catch (aiError) {
          console.error("AI provider failure:", aiError);
          output = {
            provider: "unavailable",
            modelName: null,
            verdict: "assessment_unavailable",
            confidenceScore: null,
            evidenceQuality: "partial",
            locationConsistency: "gps_coordinates_attached",
            isSufficientEvidence: true,
            summary:
              "Automated AI review timed out or was unavailable. Your report and photo are safely stored and open for community verification.",
            observations: [
              "AI model unavailable during submission.",
              "Report remains eligible for citizen corroboration.",
            ],
            rawStatus: "failed",
            errorMessage:
              aiError instanceof Error
                ? aiError.message.slice(0, 200)
                : "AI assessment failed.",
          };
        }
      }
    }

    const { data: savedAssessment, error: insertError } = await admin
      .from("groundtruth_assessments")
      .insert({
        report_id: reportId,
        evidence_id: evidenceId,
        assessment_type: assessmentType,
        provider: output.provider,
        model_name: output.modelName,
        verdict: output.verdict,
        confidence_score: output.confidenceScore,
        evidence_quality: output.evidenceQuality,
        location_consistency: output.locationConsistency,
        is_sufficient_evidence: output.isSufficientEvidence,
        summary: output.summary,
        observations: output.observations,
        disclaimer: DISCLAIMER,
        raw_status: output.rawStatus,
        error_message: output.errorMessage,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Failed to store AI assessment:", insertError);
      return respond({ error: "Could not store AI assessment." }, 500);
    }

    const nextAiStatus =
      output.rawStatus === "completed"
        ? "completed"
        : output.rawStatus === "insufficient_evidence"
        ? "insufficient_evidence"
        : output.rawStatus === "failed"
        ? "failed"
        : "unavailable";

    await admin
      .from("reports")
      .update({
        ai_status: nextAiStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    await admin.from("groundtruth_history").insert({
      report_id: reportId,
      actor_id: user.id,
      actor_type: "ai",
      event_type:
        output.rawStatus === "completed" ? "ai_assessed" : "ai_unavailable",
      title:
        output.rawStatus === "completed"
          ? "GroundTruth AI advisory assessment recorded"
          : output.rawStatus === "insufficient_evidence"
          ? "GroundTruth AI flagged insufficient evidence"
          : "GroundTruth AI unavailable — awaiting community review",
      details: output.summary,
      metadata: {
        assessment_id: savedAssessment.id,
        provider: output.provider,
        verdict: output.verdict,
        confidence_score: output.confidenceScore,
        raw_status: output.rawStatus,
      },
    });

    return respond({
      success: true,
      assessment: savedAssessment,
    });
  } catch (error) {
    console.error("assess-groundtruth failed:", error);
    return respond({ error: "Unable to complete GroundTruth assessment." }, 500);
  }
});
