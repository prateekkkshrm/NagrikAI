import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  FileText,
  Image as ImageIcon,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";
import {
  AI_DISCLAIMER,
  COMMUNITY_TARGET_REVIEWS,
  fetchCitizenReportsWithGroundTruth,
  fetchGroundTruthReportsVerifiedByMe,
  fetchNearbyGroundTruthReports,
  fetchReportGroundTruthDetail,
  formatCoordinates,
  formatDateTime,
  formatDistanceLabel,
  formatShortId,
  getAiVerdictMeta,
  getCommunityStatusMeta,
  getSignedEvidenceUrl,
  submitCommunityVerification,
  triggerGroundTruthAssessment,
} from "./groundtruthService";

function ScreenHeader({ title, back, right }) {
  return (
    <div className="topbar">
      {back ? (
        <button className="icon-btn" onClick={back} type="button">
          <ArrowLeft size={19} />
        </button>
      ) : (
        <span />
      )}
      <b>{title}</b>
      {right || <span style={{ width: 28 }} />}
    </div>
  );
}

function toDisplayText(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    if ("note" in value) return toDisplayText(value.note);
    return JSON.stringify(value);
  }
  return "";
}

export function EvidenceImage({ photoPath, alt = "Civic evidence", maxHeight = "200px" }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(Boolean(photoPath));
  const [previewError, setPreviewError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    if (!photoPath) {
      setUrl(null);
      setLoading(false);
      setPreviewError("");
      return;
    }
    setLoading(true);
    setUrl(null);
    setPreviewError("");
    getSignedEvidenceUrl(photoPath, retryKey > 0)
      .then((signed) => {
        if (active) {
          setUrl(signed);
          setLoading(false);
          if (!signed) setPreviewError("Storage did not return a photo preview URL.");
        }
      })
      .catch((error) => {
        if (active) {
          setPreviewError(error?.message || "Could not create a secure photo preview.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [photoPath, retryKey]);

  if (!photoPath) {
    return (
      <div className="evidence-box">
        No photographic evidence attached
      </div>
    );
  }

  if (loading) {
    return <div className="evidence-box">Loading secure evidence photo...</div>;
  }

  if (!url && previewError) {
    return (
      <div className="evidence-box">
        <p>Photo preview could not be loaded.</p>
        <small className="muted">{previewError}</small>
        <button
          type="button"
          className="btn secondary"
          style={{ marginTop: "10px" }}
          onClick={() => {
            setLoading(true);
            setRetryKey((key) => key + 1);
          }}
        >
          Retry photo preview
        </button>
      </div>
    );
  }

  if (!url) return <div className="evidence-box">Preparing secure photo preview...</div>;

  return (
    <div className="gt-photo-frame">
      <img
        src={url}
        alt={alt}
        style={{
          width: "100%",
          maxHeight,
          objectFit: "cover",
          borderRadius: "10px",
          display: "block",
        }}
        onLoad={() => setLoading(false)}
        onError={() => {
          setPreviewError("The secure photo URL expired or the storage bucket denied access.");
          setLoading(false);
          setUrl(null);
        }}
      />
    </div>
  );
}

export function GroundTruthScreen({
  go,
  notify,
  userLocation,
  selectedReportId,
  setSelectedReportId,
  onOpenReportDetails,
  onChallengeResolution,
}) {
  const [viewMode, setViewMode] = useState(selectedReportId ? "detail" : "queue");
  const [detailReturnMode, setDetailReturnMode] = useState("queue");
  const [queueFilter, setQueueFilter] = useState("needs_review");
  const [nearbyReports, setNearbyReports] = useState([]);
  const [queueStatus, setQueueStatus] = useState("loading");
  const [queueError, setQueueError] = useState("");
  const [verifiedReports, setVerifiedReports] = useState([]);
  const [verifiedReportsStatus, setVerifiedReportsStatus] = useState("loading");
  const [verifiedReportsError, setVerifiedReportsError] = useState("");

  const [detailData, setDetailData] = useState(null);
  const [detailStatus, setDetailStatus] = useState("idle");
  const [detailError, setDetailError] = useState("");

  const [selectedVote, setSelectedVote] = useState("");
  const [voteComment, setVoteComment] = useState("");
  const [votePhoto, setVotePhoto] = useState(null);
  const [submittingVote, setSubmittingVote] = useState(false);
  const [rerunningAi, setRerunningAi] = useState(false);
  const votePhotoRef = useRef(null);

  const loadQueue = async () => {
    setQueueStatus("loading");
    setQueueError("");
    try {
      const rows = await fetchNearbyGroundTruthReports({
        lat: userLocation?.lat ?? null,
        lng: userLocation?.lng ?? null,
        radiusM: 25000,
        limit: 40,
      });
      setNearbyReports(rows);
      setQueueStatus("success");
    } catch (err) {
      setQueueError(err?.message || "Could not load nearby GroundTruth reports.");
      setQueueStatus("error");
    }
  };

  const loadVerifiedReports = async () => {
    setVerifiedReportsStatus("loading");
    setVerifiedReportsError("");
    try {
      const rows = await fetchGroundTruthReportsVerifiedByMe();
      setVerifiedReports(rows);
      setVerifiedReportsStatus("success");
    } catch (err) {
      setVerifiedReportsError(err?.message || "Could not load reports you verified.");
      setVerifiedReportsStatus("error");
    }
  };

  const loadDetail = async (reportId) => {
    if (!reportId) return;
    setDetailStatus("loading");
    setDetailError("");
    try {
      const data = await fetchReportGroundTruthDetail(reportId);
      setDetailData(data);
      setDetailStatus("success");
    } catch (err) {
      setDetailError(err?.message || "Could not load GroundTruth details.");
      setDetailStatus("error");
    }
  };

  useEffect(() => {
    loadQueue();
  }, [userLocation?.lat, userLocation?.lng]);

  useEffect(() => {
    loadVerifiedReports();
  }, []);

  useEffect(() => {
    if (selectedReportId) {
      setViewMode("detail");
      loadDetail(selectedReportId);
    }
  }, [selectedReportId]);

  const filteredQueue = useMemo(() => {
    if (queueFilter === "conflicted") {
      return nearbyReports.filter(
        (r) => r.community_status === "conflicting" || r.community_status === "disputed"
      );
    }
    if (queueFilter === "needs_review") {
      return nearbyReports.filter((r) =>
        ["awaiting_verification", "in_review", "conflicting", "insufficient_evidence"].includes(
          r.community_status
        )
      );
    }
    return nearbyReports;
  }, [nearbyReports, queueFilter]);

  const handleSelectReport = (reportId, returnMode = "queue") => {
    setDetailReturnMode(returnMode);
    setSelectedReportId(reportId);
    setSelectedVote("");
    setVoteComment("");
    setVotePhoto(null);
    setViewMode("detail");
  };

  const handleSupportingPhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("Select a valid image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      notify("Supporting image must be 10 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setVotePhoto({ file, previewUrl: reader.result });
    reader.readAsDataURL(file);
  };

  const handleSubmitVerification = async () => {
    if (!detailData?.report?.id || submittingVote) return;
    if (!["confirm", "dispute"].includes(selectedVote)) {
      notify("Choose whether you confirm or dispute this report.");
      return;
    }

    setSubmittingVote(true);
    try {
      await submitCommunityVerification({
        reportId: detailData.report.id,
        vote: selectedVote,
        comment: voteComment,
        evidenceFile: votePhoto?.file || null,
        userLocation,
      });

      notify(
        selectedVote === "confirm"
          ? "Confirmation recorded in GroundTruth."
          : "Dispute recorded in GroundTruth."
      );
      setSelectedVote("");
      setVoteComment("");
      setVotePhoto(null);
      await Promise.all([
        loadDetail(detailData.report.id),
        loadQueue(),
        loadVerifiedReports(),
      ]);
    } catch (err) {
      notify(err?.message || "Could not submit your verification.");
    } finally {
      setSubmittingVote(false);
    }
  };

  const handleRunAiAssessment = async () => {
    if (!detailData?.report?.id || rerunningAi) return;
    setRerunningAi(true);
    try {
      const res = await triggerGroundTruthAssessment({
        reportId: detailData.report.id,
        assessmentType: "corroboration_recheck",
      });
      if (res.ok) {
        notify("AI advisory review updated.");
      } else {
        notify(res.error || "AI review is currently unavailable.");
      }
      await Promise.all([loadDetail(detailData.report.id), loadQueue()]);
    } finally {
      setRerunningAi(false);
    }
  };

  const activeReport = detailData?.report || null;
  const assessments = Array.isArray(detailData?.assessments) ? detailData.assessments : [];
  const latestAssessment = assessments[0] || null;
  const evidenceList = Array.isArray(detailData?.evidence) ? detailData.evidence : [];
  const verifications = Array.isArray(detailData?.verifications) ? detailData.verifications : [];
  const historyList = Array.isArray(detailData?.history) ? detailData.history : [];
  const myVote = detailData?.my_vote || null;

  const aiMeta = getAiVerdictMeta(latestAssessment, activeReport?.ai_status);
  const communityMeta = getCommunityStatusMeta(activeReport);

  return (
    <div className="page">
      <ScreenHeader
        title="GroundTruth AI"
        back={() => {
          if (viewMode === "detail" && detailReturnMode === "inspector") {
            setViewMode("inspector");
          } else if (viewMode === "detail" && nearbyReports.length > 0) {
            setViewMode("queue");
          } else {
            go("Home");
          }
        }}
        right={
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              if (viewMode === "detail" && selectedReportId) {
                loadDetail(selectedReportId);
              } else if (viewMode === "inspector") {
                loadVerifiedReports();
              } else {
                loadQueue();
              }
            }}
            title="Refresh GroundTruth"
          >
            <RefreshCw size={16} />
          </button>
        }
      />

      <div className="eyebrow">EVIDENCE + COMMUNITY CORROBORATION</div>
      <h1>Verify what's really on the ground.</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        AI scores visual alignment only and never proves authenticity. Citizens nearby confirm or dispute each report independently.
      </p>

      <div className="filter-row">
        <button
          type="button"
          className={viewMode === "queue" ? "on" : ""}
          onClick={() => setViewMode("queue")}
        >
          Nearby queue ({nearbyReports.length})
        </button>
        <button
          type="button"
          className={viewMode === "inspector" || viewMode === "detail" && detailReturnMode === "inspector" ? "on" : ""}
          onClick={() => {
            setViewMode("inspector");
            loadVerifiedReports();
          }}
        >
          Inspector
        </button>
      </div>

      {viewMode === "inspector" && (
        <>
          <div className="eyebrow">REPORTS YOU HAVE VERIFIED · {verifiedReports.length}</div>

          {verifiedReportsStatus === "loading" && (
            <section className="panel">
              <b>Loading your verification history...</b>
            </section>
          )}

          {verifiedReportsStatus === "error" && (
            <section className="panel">
              <b className="amber">Unable to load your verified reports</b>
              <p className="muted">{verifiedReportsError}</p>
              <button type="button" className="btn secondary" onClick={loadVerifiedReports}>
                Retry
              </button>
            </section>
          )}

          {verifiedReportsStatus === "success" && verifiedReports.length === 0 && (
            <section className="panel">
              <b>You have not verified any reports yet</b>
              <p className="muted">
                Reports you confirm or dispute in GroundTruth will appear here.
              </p>
              <button type="button" className="btn secondary" onClick={() => setViewMode("queue")}>
                Browse nearby reports
              </button>
            </section>
          )}

          {verifiedReportsStatus === "success" && verifiedReports.map((report) => {
            const communityMeta = getCommunityStatusMeta(report);
            const aiMeta = getAiVerdictMeta(report.latest_assessment, report.ai_status);
            return (
              <section
                key={report.id}
                className="panel gt-report-card"
                role="button"
                tabIndex={0}
                style={{ cursor: "pointer" }}
                aria-label={`Open GroundTruth details for report ${report.report_number}: ${report.title}`}
                onClick={() => handleSelectReport(report.id, "inspector")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSelectReport(report.id, "inspector");
                  }
                }}
              >
                <div className="split">
                  <b>#GN-{report.report_number} · {report.category}</b>
                  <span className={`gt-pill ${communityMeta.tone}`}>{report.status}</span>
                </div>
                <h3 style={{ margin: "6px 0 4px" }}>{report.title}</h3>
                <p className="muted" style={{ margin: "2px 0" }}>
                  {[report.locality, report.city].filter(Boolean).join(", ") ||
                    formatCoordinates(report.latitude, report.longitude)}
                </p>
                <div className="gt-dual-row">
                  <div className="gt-mini-box">
                    <small className="muted">YOUR VERIFICATION</small>
                    <b className={report.my_vote === "confirm" ? "green" : "amber"}>
                      {report.my_vote === "confirm" ? "Confirmed" : "Disputed"}
                    </b>
                  </div>
                  <div className="gt-mini-box">
                    <small className="muted">GROUNDTRUTH STATUS</small>
                    <b className={communityMeta.tone}>{communityMeta.label}</b>
                  </div>
                </div>
                <small className="muted">
                  Verified {formatDateTime(report.my_verified_at)} · {aiMeta.label}
                </small>
              </section>
            );
          })}
        </>
      )}

      {viewMode === "queue" && (
        <>
          <div className="chip-wrap">
            {[
              ["needs_review", "Needs verification"],
              ["conflicted", "Conflicting / Disputed"],
              ["all", "All nearby"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`chip ${queueFilter === key ? "on" : ""}`}
                onClick={() => setQueueFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {queueStatus === "loading" && (
            <section className="panel">
              <b>Scanning nearby reports...</b>
              <p className="muted">Fetching reports requiring GroundTruth review.</p>
            </section>
          )}

          {queueStatus === "error" && (
            <section className="panel">
              <b className="amber">Unable to load nearby GroundTruth queue</b>
              <p className="muted">{queueError}</p>
              <button type="button" className="btn secondary" onClick={loadQueue}>
                Retry
              </button>
            </section>
          )}

          {queueStatus === "success" && filteredQueue.length === 0 && (
            <section className="panel">
              <b>No reports in this verification view</b>
              <p className="muted">
                Submit a civic issue or switch filter to view all nearby reports.
              </p>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setQueueFilter("all")}
              >
                Show all nearby reports
              </button>
            </section>
          )}

          {queueStatus === "success" &&
            filteredQueue.map((report) => {
              const cMeta = getCommunityStatusMeta(report);
              const aMeta = getAiVerdictMeta(
                report.latest_ai_verdict
                  ? {
                      verdict: report.latest_ai_verdict,
                      confidence_score: report.latest_ai_confidence,
                      summary: report.latest_ai_summary,
                    }
                  : null,
                report.ai_status
              );
              return (
                <section key={report.id} className="panel gt-report-card">
                  <div className="split">
                    <b>#GN-{report.report_number} · {report.category}</b>
                    <span className={`gt-pill ${cMeta.tone}`}>{cMeta.label}</span>
                  </div>
                  <h3 style={{ margin: "6px 0 4px" }}>{report.title}</h3>
                  <p className="muted" style={{ margin: "2px 0" }}>
                    <MapPin size={11} style={{ verticalAlign: "middle" }} />{" "}
                    {[report.locality, report.city].filter(Boolean).join(", ") ||
                      formatCoordinates(report.latitude, report.longitude)}
                    {Number.isFinite(Number(report.distance_m))
                      ? ` · ${formatDistanceLabel(report.distance_m)}`
                      : ""}
                  </p>

                  <div className="gt-dual-row">
                    <div className="gt-mini-box">
                      <small className="muted">AI ADVISORY (NOT PROOF)</small>
                      <b className={aMeta.tone}>{aMeta.label}</b>
                    </div>
                    <div className="gt-mini-box">
                      <small className="muted">COMMUNITY VOTES</small>
                      <b>
                        {report.confirm_count || 0} confirm · {report.dispute_count || 0} dispute
                      </b>
                    </div>
                  </div>

                  <div className="progress" aria-label="Verification progress">
                    <i style={{ width: `${cMeta.progressPct}%` }} />
                  </div>
                  <div className="split" style={{ marginBottom: "8px" }}>
                    <small className="muted">
                      Progress: {report.verification_count || 0}/{COMMUNITY_TARGET_REVIEWS} reviews
                    </small>
                    {report.my_vote && (
                      <small className="green">
                        You voted: {report.my_vote}
                      </small>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn"
                    style={{ margin: 0 }}
                    onClick={() => handleSelectReport(report.id, "queue")}
                  >
                    Inspect evidence & verify
                  </button>
                </section>
              );
            })}
        </>
      )}

      {viewMode === "detail" && (
        <>
          {!selectedReportId && detailStatus === "idle" && (
            <section className="panel">
              <b>Select a report to verify</b>
              <p className="muted">
                Choose any nearby report from the queue or open one from My Reports.
              </p>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setViewMode("queue")}
              >
                Browse nearby queue
              </button>
            </section>
          )}

          {detailStatus === "loading" && (
            <section className="panel">
              <b>Loading GroundTruth dossier...</b>
              <p className="muted">Fetching evidence, AI advisory assessment, and verification history.</p>
            </section>
          )}

          {detailStatus === "error" && (
            <section className="panel">
              <b className="amber">Could not load GroundTruth dossier</b>
              <p className="muted">{detailError}</p>
              <button
                type="button"
                className="btn secondary"
                onClick={() => loadDetail(selectedReportId)}
              >
                Try again
              </button>
            </section>
          )}

          {detailStatus === "success" && activeReport && (
            <>
              <section className="panel">
                <div className="split">
                  <b>#GN-{activeReport.report_number} · {activeReport.category}</b>
                  <span className="gt-pill green">{activeReport.severity} severity</span>
                </div>
                <h2 style={{ margin: "6px 0" }}>{activeReport.title}</h2>
                <p style={{ marginTop: 0 }}>{activeReport.description}</p>
                <small className="muted" style={{ display: "block" }}>
                  Report ID: {formatShortId(activeReport.id)} · Submitted {formatDateTime(activeReport.created_at)}
                </small>
                <small className="muted" style={{ display: "block", marginTop: "4px" }}>
                  Location: {[activeReport.locality, activeReport.city, activeReport.state].filter(Boolean).join(", ") || "Pinned coordinates"} (
                  {formatCoordinates(activeReport.latitude, activeReport.longitude)}) ·{" "}
                  {activeReport.location_source === "manual_adjusted" ? "Citizen-adjusted pin" : "GPS tagged"}
                </small>
              </section>

              {/* Available Evidence */}
              <div className="eyebrow">AVAILABLE EVIDENCE ({1 + evidenceList.length - (activeReport.photo_path ? 0 : 1)})</div>
              <section className="panel">
                <small className="muted">PRIMARY REPORT PHOTO</small>
                <EvidenceImage photoPath={activeReport.photo_path} alt={activeReport.title} />

                {evidenceList.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <small className="muted">ADDITIONAL CITIZEN EVIDENCE ({evidenceList.length})</small>
                    {evidenceList.map((ev) => (
                      <div key={ev.id} className="gt-subcard">
                        <EvidenceImage photoPath={ev.photo_path} alt="Supporting evidence" maxHeight="160px" />
                        {toDisplayText(ev.note) && (
                          <p style={{ margin: "6px 0 2px" }}>{toDisplayText(ev.note)}</p>
                        )}
                        <small className="muted">
                          Role: {ev.evidence_role || "supporting"} · {formatDateTime(ev.created_at)}
                        </small>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* AI Assessment Card — Strictly Separated from Community Corroboration */}
              <div className="eyebrow">1. AI ADVISORY ASSESSMENT (SEPARATE FROM COMMUNITY)</div>
              <section className="panel insight">
                <div className="split">
                  <b>
                    <Sparkles size={13} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                    {aiMeta.label}
                  </b>
                  <span className={`gt-pill ${aiMeta.tone}`}>Advisory only</span>
                </div>

                {typeof latestAssessment?.confidence_score === "number" ? (
                  <div style={{ marginTop: "8px" }}>
                    <div className="split">
                      <small className="muted">Visual alignment score (not authenticity proof)</small>
                      <b>{latestAssessment.confidence_score}%</b>
                    </div>
                    <div className="progress">
                      <i style={{ width: `${latestAssessment.confidence_score}%` }} />
                    </div>
                  </div>
                ) : (
                  <p className="muted" style={{ marginTop: "8px" }}>
                    Visual alignment score: Unavailable / withheld
                  </p>
                )}

                <p>{aiMeta.summary}</p>

                {Array.isArray(latestAssessment?.observations) &&
                  latestAssessment.observations.length > 0 && (
                    <ul className="gt-obs-list">
                      {latestAssessment.observations.map((obs, idx) => (
                        <li key={idx}>{obs}</li>
                      ))}
                    </ul>
                  )}

                {(!latestAssessment || !latestAssessment.is_sufficient_evidence) && (
                  <div className="gt-alert-banner amber">
                    <AlertTriangle size={14} />
                    <span>
                      Evidence flagged as incomplete or awaiting clearer visual proof. AI does not treat this as verified.
                    </span>
                  </div>
                )}

                <small className="muted" style={{ display: "block", marginTop: "8px" }}>
                  {latestAssessment?.disclaimer || AI_DISCLAIMER}
                </small>
                {latestAssessment?.provider && (
                  <small className="muted" style={{ display: "block", marginTop: "4px" }}>
                    Engine: {latestAssessment.provider}
                    {latestAssessment.model_name ? ` (${latestAssessment.model_name})` : ""}
                  </small>
                )}

                {aiMeta.canRetry && (
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ marginTop: "10px", marginBottom: 0 }}
                    disabled={rerunningAi}
                    onClick={handleRunAiAssessment}
                  >
                    {rerunningAi ? "Running AI advisory review..." : "Run / Retry AI advisory review"}
                  </button>
                )}
              </section>

              {/* Community Corroboration Card — Strictly Separated */}
              <div className="eyebrow">2. COMMUNITY CORROBORATION (INDEPENDENT CITIZEN VOTES)</div>
              <section className="panel">
                <div className="split">
                  <b>
                    <Users size={13} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                    {communityMeta.label}
                  </b>
                  <span className={`gt-pill ${communityMeta.tone}`}>
                    {activeReport.verification_count || 0}/{COMMUNITY_TARGET_REVIEWS} reviews
                  </span>
                </div>

                <div className="progress">
                  <i style={{ width: `${communityMeta.progressPct}%` }} />
                </div>

                <div className="gt-dual-row">
                  <div className="gt-mini-box">
                    <small className="muted">CONFIRMED ON SITE</small>
                    <b className="green">{activeReport.confirm_count || 0}</b>
                  </div>
                  <div className="gt-mini-box">
                    <small className="muted">DISPUTED / NOT FOUND</small>
                    <b className="amber">{activeReport.dispute_count || 0}</b>
                  </div>
                </div>

                <p className="muted">{communityMeta.description}</p>

                {activeReport.status === "Resolved" && onChallengeResolution && (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => onChallengeResolution(activeReport.id)}
                  >
                    Challenge resolved status
                  </button>
                )}

                {communityMeta.isConflicting && (
                  <div className="gt-alert-banner amber">
                    <ShieldAlert size={15} />
                    <span>
                      Conflicting community responses detected. Additional geo-tagged photographic evidence is required before status can settle.
                    </span>
                  </div>
                )}

                {communityMeta.isInsufficient && (
                  <div className="gt-alert-banner amber">
                    <AlertTriangle size={15} />
                    <span>
                      Insufficient evidence attached. Submit a clear on-site photograph alongside your verification vote.
                    </span>
                  </div>
                )}

                {myVote ? (
                  <div className="gt-alert-banner green" style={{ marginTop: "10px" }}>
                    <ShieldCheck size={15} />
                    <span>
                      You already submitted your verification ({myVote === "confirm" ? "Confirmed" : "Disputed"}). One vote per citizen per report is enforced.
                    </span>
                  </div>
                ) : (
                  <div className="gt-vote-box">
                    <b>Participate in on-ground verification</b>
                    <div className="filter-row" style={{ marginTop: "8px" }}>
                      <button
                        type="button"
                        className={selectedVote === "confirm" ? "on" : ""}
                        onClick={() => setSelectedVote("confirm")}
                      >
                        <ThumbsUp size={13} style={{ marginRight: "5px", verticalAlign: "middle" }} />
                        Confirm issue
                      </button>
                      <button
                        type="button"
                        className={selectedVote === "dispute" ? "on" : ""}
                        onClick={() => setSelectedVote("dispute")}
                      >
                        <ThumbsDown size={13} style={{ marginRight: "5px", verticalAlign: "middle" }} />
                        Dispute / Not valid
                      </button>
                    </div>

                    <label className="field" style={{ margin: "10px 0" }}>
                      <span>VERIFICATION NOTE (OPTIONAL)</span>
                      <textarea
                        rows={2}
                        value={voteComment}
                        onChange={(e) => setVoteComment(e.target.value)}
                        maxLength={400}
                        placeholder="Share what you observed at this spot..."
                      />
                    </label>

                    <input
                      ref={votePhotoRef}
                      type="file"
                      accept="image/*"
                      onChange={handleSupportingPhoto}
                      style={{ display: "none" }}
                    />

                    {votePhoto?.previewUrl && (
                      <div style={{ marginBottom: "8px" }}>
                        <img
                          src={votePhoto.previewUrl}
                          alt="Supporting verification preview"
                          style={{
                            width: "100%",
                            maxHeight: "140px",
                            objectFit: "cover",
                            borderRadius: "8px",
                          }}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => votePhotoRef.current?.click()}
                    >
                      <ImageIcon size={14} />{" "}
                      {votePhoto ? "Change supporting photo" : "Add supporting photo (optional)"}
                    </button>

                    <button
                      type="button"
                      className="btn"
                      disabled={submittingVote || !selectedVote}
                      onClick={handleSubmitVerification}
                    >
                      {submittingVote ? "Submitting verification..." : "Submit GroundTruth vote"}
                    </button>
                  </div>
                )}

                {verifications.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <small className="muted">RECENT CITIZEN REVIEWS ({verifications.length})</small>
                    {verifications.slice(0, 5).map((v) => (
                      <div key={v.id} className="gt-subcard">
                        <div className="split">
                          <b className={v.vote === "confirm" ? "green" : "amber"}>
                            {v.vote === "confirm" ? "Confirmed" : "Disputed"}
                            {v.is_mine ? " (You)" : ""}
                          </b>
                          <small className="muted">{formatDateTime(v.created_at)}</small>
                        </div>
                        {v.comment && <p style={{ margin: "4px 0 0" }}>{v.comment}</p>}
                        {Number.isFinite(Number(v.distance_m)) && (
                          <small className="muted">
                            Verified from {formatDistanceLabel(v.distance_m)}
                          </small>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Verification History */}
              <AuthorityResolutionCard report={activeReport} />
              <div className="eyebrow">3. VERIFICATION HISTORY ({historyList.length})</div>
    
          <section className="panel timeline">
                {historyList.length === 0 ? (
                  <p className="muted">No history events recorded yet.</p>
                ) : (
                  historyList.map((event) => (
                    <p key={event.id}>
                      <b style={{ display: "block" }}>
                        {event.title} ·{" "}
                        <span className="muted" style={{ fontWeight: 500 }}>
                          {event.actor_type?.toUpperCase()}
                        </span>
                      </b>
                      {event.details && (
                        <span className="muted" style={{ display: "block", fontSize: "11px" }}>
                          {toDisplayText(event.details)}
                        </span>
                      )}
                      <small className="muted">{formatDateTime(event.created_at)}</small>
                    </p>
                  ))
                )}
              </section>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => onOpenReportDetails(activeReport.id)}
                >
                  Issue details
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => go("Reference tracking")}
                >
                  Track status
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function AuthorityResolutionCard({ report, embedded = false }) {
  const resolutionNote = toDisplayText(report?.resolution_note);
  const authenticityNote = toDisplayText(report?.authenticity_note);
  if (
    !report ||
    (report.status !== "Resolved" &&
      !report.resolution_photo_path &&
      !resolutionNote &&
      (!report.authenticity_verdict || report.authenticity_verdict === "unverified"))
  ) {
    return null;
  }

  const Wrapper = embedded ? "div" : "section";
  const wrapperProps = embedded
    ? {
        style: {
          marginBottom: "14px",
          paddingBottom: "12px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        },
      }
    : { className: "panel" };

  return (
    <Wrapper {...wrapperProps}>
      <div className="split">
        <b>Authority Review &amp; Resolution</b>
        <span
          className={`gt-pill ${
            report.authenticity_verdict === "fake_report"
              ? "danger"
              : report.status === "Resolved" || report.authenticity_verdict === "true_report"
                ? "green"
                : "amber"
          }`}
        >
          {report.authenticity_verdict === "fake_report"
            ? "Flagged Fake"
            : report.status === "Resolved"
              ? report.resolved_on_time
                ? "Resolved On Time"
                : "Resolved"
              : "Verified Genuine"}
        </span>
      </div>
      {report.resolution_photo_path && (
        <div style={{ marginTop: "8px", display: "grid", gap: "8px" }}>
          {report.photo_path && (
            <div>
              <small className="muted">BEFORE (YOUR REPORT)</small>
              <EvidenceImage photoPath={report.photo_path} alt="Before repair" maxHeight="140px" />
            </div>
          )}
          <div>
            <small className="muted">AFTER REPAIR (AUTHORITY PROOF)</small>
            <EvidenceImage photoPath={report.resolution_photo_path} alt="Authority repair proof" maxHeight="180px" />
          </div>
        </div>
      )}

      {resolutionNote && (
        <p style={{ marginTop: "8px", marginBottom: "4px" }}>{resolutionNote}</p>
      )}
      {authenticityNote && (
        <small className="muted" style={{ display: "block" }}>
          Verification note: {authenticityNote}
        </small>
      )}
      {report.resolved_at && (
        <small className="muted" style={{ display: "block", marginTop: "4px" }}>
          Resolved on {formatDateTime(report.resolved_at)}
        </small>
      )}
    </Wrapper>
  );
}

export function IssueDetailsScreen({
  go,
  selectedReportId,
  fallbackIssueTitle,
  onOpenGroundTruth,
  onOpenTracking,
}) {
  const [detailData, setDetailData] = useState(null);
  const [status, setStatus] = useState(selectedReportId ? "loading" : "empty");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!selectedReportId) {
      setStatus("empty");
      return;
    }
    setStatus("loading");
    setError("");
    fetchReportGroundTruthDetail(selectedReportId)
      .then((data) => {
        if (active) {
          setDetailData(data);
          setStatus("success");
        }
      })
      .catch((err) => {
        if (active) {
          setError(err?.message || "Could not load issue details.");
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, [selectedReportId]);

  const report = detailData?.report || null;
  const latestAssessment = Array.isArray(detailData?.assessments)
    ? detailData.assessments[0]
    : null;
  const history = Array.isArray(detailData?.history) ? detailData.history : [];
  const aiMeta = getAiVerdictMeta(latestAssessment, report?.ai_status);
  const communityMeta = getCommunityStatusMeta(report);

  return (
    <div className="page">
      <ScreenHeader
        title={report ? `Issue #GN-${report.report_number}` : "Issue details"}
        back={() => go("Report history")}
      />

      {status === "empty" && (
        <section className="panel">
          <b>No report selected</b>
          <p className="muted">
            {fallbackIssueTitle
              ? `Draft: ${fallbackIssueTitle}. Open My Reports or GroundTruth AI to inspect a submitted report.`
              : "Choose a report from My Reports or GroundTruth AI to view full details."}
          </p>
          <button type="button" className="btn" onClick={() => go("Report history")}>
            Open My Reports
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => go("GroundTruth AI")}
          >
            Open GroundTruth AI
          </button>
        </section>
      )}

      {status === "loading" && (
        <section className="panel">
          <b>Loading report details...</b>
        </section>
      )}

      {status === "error" && (
        <section className="panel">
          <b className="amber">Unable to load issue</b>
          <p className="muted">{error}</p>
        </section>
      )}

      {status === "success" && report && (
        <>
          <div className="eyebrow">
            #GN-{report.report_number} · {report.status?.toUpperCase()}
          </div>
          <h1>{report.title}</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Report ID: {report.id}
          </p>

          <section className="panel">
            <EvidenceImage photoPath={report.photo_path} alt={report.title} />
            <p style={{ marginTop: "10px" }}>{report.description}</p>
            <small className="muted" style={{ display: "block" }}>
              Category: {report.category} · Severity: {report.severity}
            </small>
            <small className="muted" style={{ display: "block", marginTop: "4px" }}>
              Location: {[report.locality, report.city, report.state].filter(Boolean).join(", ") || "Pinned coordinates"} (
              {formatCoordinates(report.latitude, report.longitude)})
            </small>
            <small className="muted" style={{ display: "block", marginTop: "4px" }}>
              Submitted: {formatDateTime(report.created_at)}
            </small>
          </section>

          <section className="panel">
            <div className="split">
              <b>AI Advisory Assessment</b>
              <span className={`gt-pill ${aiMeta.tone}`}>{aiMeta.label}</span>
            </div>
            <p className="muted">{aiMeta.summary}</p>
            <div className="split" style={{ marginTop: "8px" }}>
              <b>Community Corroboration</b>
              <span className={`gt-pill ${communityMeta.tone}`}>{communityMeta.label}</span>
            </div>
            <small className="muted">
              {report.confirm_count || 0} confirmed · {report.dispute_count || 0} disputed ·{" "}
              {report.evidence_count || 1} evidence file(s)
            </small>
          </section>


          <section className="panel timeline">
            <AuthorityResolutionCard report={report} embedded />
            <b>Recent verification timeline</b>
            {history.length === 0 ? (
              <p className="muted">Submitted on {formatDateTime(report.created_at)}</p>
            ) : (
              history.slice(-4).map((item) => (
                <p key={item.id}>
                  <b>{item.title}</b>
                  <br />
                  <small className="muted">{formatDateTime(item.created_at)}</small>
                </p>
              ))
            )}
          </section>

          <button
            type="button"
            className="btn"
            onClick={() => onOpenGroundTruth(report.id)}
          >
            Open GroundTruth verification
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => onOpenTracking(report.id)}
          >
            View status tracking
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => go("Responsible authority")}
          >
            Responsible authority
          </button>
        </>
      )}
    </div>
  );
}

export function MyReportsScreen({
  go,
  onSelectReportDetails,
  onSelectGroundTruth,
  onSelectTracking,
}) {
  const [reports, setReports] = useState([]);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    setLoadStatus("loading");
    setLoadError("");
    try {
      const rows = await fetchCitizenReportsWithGroundTruth();
      setReports(rows);
      setLoadStatus("success");
    } catch (err) {
      setLoadError(err?.message || "Could not load your reports.");
      setLoadStatus("error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredReports = useMemo(() => {
    if (statusFilter === "resolved") {
      return reports.filter((r) => r.status === "Resolved");
    }
    if (statusFilter === "verified") {
      return reports.filter((r) => r.community_status === "corroborated");
    }
    if (statusFilter === "conflicting") {
      return reports.filter((r) =>
        ["conflicting", "disputed"].includes(r.community_status)
      );
    }
    if (statusFilter === "open") {
      return reports.filter((r) => r.status !== "Resolved");
    }
    return reports;
  }, [reports, statusFilter]);

  const resolvedCount = reports.filter((r) => r.status === "Resolved").length;
  const openCount = reports.length - resolvedCount;

  return (
    <div className="page">
      <ScreenHeader
        title="My reports"
        back={() => go("Profile")}
        right={
          <button type="button" className="icon-btn" onClick={load} title="Refresh reports">
            <RefreshCw size={16} />
          </button>
        }
      />

      {loadStatus === "loading" && (
        <section className="panel">
          <b>Loading your citizen reports...</b>
        </section>
      )}

      {loadStatus === "error" && (
        <section className="panel">
          <b className="amber">Unable to load report history</b>
          <p className="muted">{loadError}</p>
          <button type="button" className="btn secondary" onClick={load}>
            Retry
          </button>
        </section>
      )}

      {loadStatus === "success" && (
        <>
          <div className="eyebrow">
            {reports.length} REPORTS · {resolvedCount} RESOLVED · {openCount} OPEN
          </div>

          <div className="chip-wrap">
            {[
              ["all", "All"],
              ["open", "Open"],
              ["verified", "Corroborated"],
              ["conflicting", "Conflicting"],
              ["resolved", "Resolved"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`chip ${statusFilter === key ? "on" : ""}`}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredReports.length === 0 ? (
            <div className="empty-state">
              <FileText size={34} />
              <h2>{reports.length === 0 ? "No reports yet." : "No matching reports."}</h2>
              <p>
                {reports.length === 0
                  ? "Your submitted civic reports and GroundTruth tracking will appear here."
                  : "Try selecting another status filter."}
              </p>
            </div>
          ) : (
            filteredReports.map((report) => {
              const aiMeta = getAiVerdictMeta(report.latest_assessment, report.ai_status);
              const cMeta = getCommunityStatusMeta(report);

              return (
                <section key={report.id} className="panel">
                  <div className="split">
                    <b>#GN-{report.report_number} · {report.category}</b>
                    <span className={`gt-pill ${report.status === "Resolved" ? "green" : cMeta.tone}`}>
                      {report.status}
                    </span>
                  </div>

                  <h3 style={{ margin: "6px 0 4px" }}>{report.title}</h3>
                  <small className="muted" style={{ display: "block" }}>
                    ID: {formatShortId(report.id)} · {formatDateTime(report.created_at)}
                  </small>
                  <small className="muted" style={{ display: "block", marginTop: "3px" }}>
                    {[report.locality, report.city].filter(Boolean).join(", ") ||
                      formatCoordinates(report.latitude, report.longitude)}
                  </small>

                  <div className="gt-dual-row">
                    <div className="gt-mini-box">
                      <small className="muted">AI ADVISORY</small>
                      <b className={aiMeta.tone}>{aiMeta.label}</b>
                    </div>
                    <div className="gt-mini-box">
                      <small className="muted">COMMUNITY</small>
                      <b className={cMeta.tone}>
                        {report.confirm_count || 0} confirm · {report.dispute_count || 0} dispute
                      </b>
                    </div>
                  </div>

                  {(report.resolution_photo_path || report.resolution_note) && (
                    <div className="gt-subcard" style={{ marginTop: "8px" }}>
                      <small className="muted">AUTHORITY REPAIR UPDATE</small>
                      {report.resolution_note && (
                        <p style={{ margin: "4px 0" }}>{toDisplayText(report.resolution_note)}</p>
                      )}
                      {report.resolution_photo_path && (
                        <EvidenceImage
                          photoPath={report.resolution_photo_path}
                          alt="After repair proof"
                          maxHeight="140px"
                        />
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ flex: 1, margin: 0, height: "38px" }}
                      onClick={() => onSelectReportDetails(report.id)}
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ flex: 1, margin: 0, height: "38px" }}
                      onClick={() => onSelectGroundTruth(report.id)}
                    >
                      GroundTruth
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{ flex: 1, margin: 0, height: "38px" }}
                      onClick={() => onSelectTracking(report.id)}
                    >
                      Track
                    </button>
                  </div>
                </section>
              );
            })
          )}
        </>
      )}

      <button type="button" className="btn" onClick={() => go("Capture report")}>
        Report something new
      </button>
    </div>
  );
}

export function TrackingScreen({ go, selectedReportId, onOpenGroundTruth }) {
  const [detailData, setDetailData] = useState(null);
  const [status, setStatus] = useState(selectedReportId ? "loading" : "empty");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!selectedReportId) {
      setStatus("empty");
      return;
    }
    setStatus("loading");
    fetchReportGroundTruthDetail(selectedReportId)
      .then((data) => {
        if (active) {
          setDetailData(data);
          setStatus("success");
        }
      })
      .catch((err) => {
        if (active) {
          setError(err?.message || "Could not load tracking status.");
          setStatus("error");
        }
      });
    return () => {
      active = false;
    };
  }, [selectedReportId]);

  const report = detailData?.report || null;
  const history = Array.isArray(detailData?.history) ? detailData.history : [];

  const stages = report
    ? [
        {
          label: "Submitted to NagrikAI",
          done: true,
        },
        {
          label: "AI advisory assessment",
          done: ["completed", "insufficient_evidence", "unavailable", "failed"].includes(
            report.ai_status
          ),
        },
        {
          label: "Community GroundTruth review",
          done: Number(report.verification_count || 0) > 0,
        },
        {
          label:
            report.community_status === "conflicting"
              ? "Conflicting responses (needs evidence)"
              : "Community corroboration settled",
          done: ["corroborated", "disputed", "conflicting"].includes(
            report.community_status
          ),
        },
        {
          label: "Resolved",
          done: report.status === "Resolved",
        },
      ]
    : [];

  return (
    <div className="page">
      <ScreenHeader title="Report status tracking" back={() => go("Report history")} />

      {status === "empty" && (
        <section className="panel">
          <h3>Select a report to track</h3>
          <p className="muted">
            Open any report from My Reports to view its live submission, AI advisory, and community verification stages.
          </p>
          <button type="button" className="btn" onClick={() => go("Report history")}>
            View My Reports
          </button>
        </section>
      )}

      {status === "loading" && (
        <section className="panel">
          <b>Loading status timeline...</b>
        </section>
      )}

      {status === "error" && (
        <section className="panel">
          <b className="amber">Tracking unavailable</b>
          <p className="muted">{error}</p>
        </section>
      )}

      {status === "success" && report && (
        <>
          <div className="eyebrow">
            #GN-{report.report_number} · {report.status?.toUpperCase()}
          </div>
          <h2>{report.title}</h2>
          <small className="muted" style={{ display: "block", marginBottom: "10px" }}>
            Report ID: {report.id}
          </small>

          <section className="panel">
            <b>Lifecycle stages</b>
            <div style={{ marginTop: "8px", display: "grid", gap: "8px" }}>
              {stages.map((s) => (
                <div key={s.label} className="split">
                  <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px" }}>
                    {s.done ? (
                      <CheckCircle2 size={15} color="#28d7a0" />
                    ) : (
                      <Clock3 size={15} color="#81909a" />
                    )}
                    {s.label}
                  </span>
                  <span className={s.done ? "green" : "muted"}>
                    {s.done ? "Completed" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </section>


          <section className="panel timeline">
            <AuthorityResolutionCard report={report} embedded />
            <b>Audit & verification log</b>
            {history.length === 0 ? (
              <p className="muted">No events recorded yet.</p>
            ) : (
              history.map((h) => (
                <p key={h.id}>
                  <b>{h.title}</b>
                  {h.details && (
                    <span className="muted" style={{ display: "block", fontSize: "11px" }}>
                      {toDisplayText(h.details)}
                    </span>
                  )}
                  <small className="muted">{formatDateTime(h.created_at)}</small>
                </p>
              ))
            )}
          </section>

          <button
            type="button"
            className="btn"
            onClick={() => onOpenGroundTruth(report.id)}
          >
            Inspect GroundTruth evidence
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={() => go("Report history")}
          >
            Back to My Reports
          </button>
        </>
      )}
    </div>
  );
}
