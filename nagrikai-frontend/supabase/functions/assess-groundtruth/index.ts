import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentication required.");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: auth } = await userClient.auth.getUser();
    if (!auth?.user) throw new Error("Authentication required.");

    const { reportId, evidenceId = null, assessmentType = "initial_submission" } = await req.json();
    if (!reportId) throw new Error("Report ID is required.");

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("id, title, description, category, photo_path")
      .eq("id", reportId)
      .single();
    if (reportError) throw reportError;

    const summary = "The report is recorded for GroundTruth review. AI/advisory evidence must be corroborated by nearby citizens.";
    const verdict = "needs_human_review";

    const { error: insertError } = await supabase.from("groundtruth_assessments").insert({
      report_id: reportId,
      evidence_id: evidenceId,
      assessment_type: assessmentType,
      provider: "nagrikai",
      model_name: Deno.env.get("GEMINI_API_KEY") ? "gemini-category-verification" : "human-verification-fallback",
      verdict,
      confidence_score: null,
      evidence_quality: "partial",
      location_consistency: "unverified",
      is_sufficient_evidence: Boolean(report.photo_path),
      summary,
      observations: [{ note: "Visual/provider-specific assessment should be confirmed by field verification." }],
      raw_status: "completed",
      created_by: auth.user.id,
    });
    if (insertError) throw insertError;

    await supabase.from("reports").update({
      ai_status: "pending",
      groundtruth_status: "Pending Community Verification",
      updated_at: new Date().toISOString(),
    }).eq("id", reportId);

    await supabase.from("groundtruth_history").insert({
      report_id: reportId,
      actor_id: auth.user.id,
      actor_type: "ai",
      event_type: "ai_assessment_created",
      title: "GroundTruth advisory assessment created",
      details: summary,
      metadata: { assessment_type: assessmentType, verdict },
    });

    return new Response(JSON.stringify({
      success: true,
      assessment: { verdict, summary, evidence_quality: "partial" },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Assessment failed.",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
