import React, { useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Image as ImageIcon,
  MapPin,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { fileToBase64, formatDateTime, getSlaState } from "../adminService";

export default function IssueFixedView({
  reports,
  selectedReportId,
  onSelectReport,
  onResolveSubmit,
  onPreviewPhoto,
  resolving,
}) {
  const openReports = useMemo(
    () =>
      reports.filter(
        (r) => r.status !== "Resolved" && r.authenticity_verdict !== "fake_report"
      ),
    [reports]
  );

  const selected = useMemo(
    () =>
      openReports.find((r) => r.id === selectedReportId) ||
      reports.find((r) => r.id === selectedReportId) ||
      openReports[0] ||
      null,
    [openReports, reports, selectedReportId]
  );

  const [note, setNote] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoBase64, setPhotoBase64] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const handlePhotoPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPEG, PNG, WEBP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Photo must be 10 MB or smaller.");
      return;
    }
    setError("");
    const b64 = await fileToBase64(file);
    setPhotoFile(file);
    setPhotoPreview(b64);
    setPhotoBase64(b64);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected) return;
    if (!photoBase64) {
      setError("Please upload an after-repair photo so the citizen can verify the fix in the app.");
      return;
    }
    if (note.trim().length < 5) {
      setError("Please add resolution details (minimum 5 characters).");
      return;
    }
    setError("");
    const ok = await onResolveSubmit({
      reportId: selected.id,
      resolutionNote: note.trim(),
      photoBase64,
      photoMimeType: photoFile?.type || "image/jpeg",
    });
    if (ok) {
      setNote("");
      setPhotoFile(null);
      setPhotoPreview("");
      setPhotoBase64("");
    }
  };

  const sla = selected ? getSlaState(selected) : null;

  return (
    <div className="split-grid">
      {/* Left: Select Report */}
      <section className="sq-card">
        <div className="sq-card-head">
          <div>
            <h3>1. Select Report to Resolve</h3>
            <p className="sq-sub">
              {openReports.length} open civic report{openReports.length === 1 ? "" : "s"} from citizen app
            </p>
          </div>
          <span className="sq-pill teal">{openReports.length} Open</span>
        </div>

        <div className="issue-list">
          {openReports.length === 0 ? (
            <div className="sq-empty">
              <CheckCircle2 size={30} />
              <strong>All caught up</strong>
              <p>No pending reports remaining in Supabase right now.</p>
            </div>
          ) : (
            openReports.map((r) => {
              const itemSla = getSlaState(r);
              const isActive = selected?.id === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`issue-row ${isActive ? "active" : ""}`}
                  onClick={() => onSelectReport(r.id)}
                >
                  <div className="issue-row-top">
                    <span className="issue-num">#GN-{r.report_number}</span>
                    <span className={`sq-pill ${itemSla.tone}`}>{itemSla.label}</span>
                  </div>
                  <div className="issue-title">{r.title}</div>
                  <div className="issue-meta">
                    <span>{r.category}</span>
                    <span>•</span>
                    <span>{[r.locality, r.city].filter(Boolean).join(", ") || "Pinned"}</span>
                    <span>•</span>
                    <span>{r.reporter_ref}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Right: Add details (photo new) -> Submit -> Reflect to user */}
      <section className="sq-card">
        <div className="sq-card-head">
          <div>
            <h3>2. Upload After-Repair Photo &amp; Resolution Details</h3>
            <p className="sq-sub">
              Reflects immediately in the NagrikAI citizen app (My Reports, Issue Details, Tracking &amp; Notifications) and updates the Autho-meter.
            </p>
          </div>
        </div>

        {!selected ? (
          <div className="sq-empty">
            <FileCheck2 size={30} />
            <strong>No report selected</strong>
            <p>Select an open report on the left to attach repair proof and notify the citizen.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="resolve-form">
            <div className="selected-summary">
              <div className="issue-row-top">
                <span className="issue-num">
                  #GN-{selected.report_number} · {selected.category}
                </span>
                <span className={`sq-pill ${sla.tone}`}>{sla.label}</span>
              </div>
              <h4>{selected.title}</h4>
              <p className="sq-sub">{selected.description}</p>
              <div className="meta-strip">
                <span>
                  <MapPin size={13} />{" "}
                  {[selected.locality, selected.city].filter(Boolean).join(", ") ||
                    `${Number(selected.latitude).toFixed(4)}, ${Number(selected.longitude).toFixed(4)}`}
                </span>
                <span>
                  <Clock3 size={13} /> Raised {formatDateTime(selected.created_at)}
                </span>
                <span>
                  <ShieldCheck size={13} /> {selected.reporter_ref} (Trust:{" "}
                  {selected.reporter_trust_score}%)
                </span>
              </div>
            </div>

            <div className="photo-compare-grid">
              <div className="photo-box">
                <small className="field-label">BEFORE (CITIZEN EVIDENCE)</small>
                {selected.photo_url ? (
                  <img
                    src={selected.photo_url}
                    alt={selected.title}
                    className="evidence-img clickable"
                    onClick={() =>
                      onPreviewPhoto?.({
                        url: selected.photo_url,
                        title: `Before — #GN-${selected.report_number}`,
                      })
                    }
                  />
                ) : (
                  <div className="photo-empty">No citizen photo attached</div>
                )}
              </div>

              <div className="photo-box">
                <small className="field-label">AFTER REPAIR (UPLOAD NEW PHOTO)</small>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoPick}
                  style={{ display: "none" }}
                />
                <div
                  className="upload-dropzone"
                  onClick={() => fileRef.current?.click()}
                >
                  {photoPreview ? (
                    <div className="upload-preview-wrap">
                      <img
                        src={photoPreview}
                        alt="After repair preview"
                        className="evidence-img"
                      />
                      <div className="upload-preview-meta">
                        <span>
                          <ImageIcon size={14} /> {photoFile?.name || "Selected photo"}
                        </span>
                        <button
                          type="button"
                          className="sq-btn ghost sm"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            fileRef.current?.click();
                          }}
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="upload-placeholder">
                      <Camera size={22} />
                      <strong>Upload repair photo</strong>
                      <span>JPEG, PNG, WEBP (max 10 MB)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="field-block">
              <label className="field-label" htmlFor="resolution-note">
                RESOLUTION REMARKS (REFLECTS IN CITIZEN APP NOTIFICATION)
              </label>
              <textarea
                id="resolution-note"
                rows={4}
                className="sq-textarea"
                placeholder="Describe the repair completed, crew/department action, and verification notes..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={800}
              />
            </div>

            {error && <div className="sq-alert danger">{error}</div>}

            <div className="sla-impact-note">
              {sla?.overdue
                ? "SLA Note: This issue is past its target deadline. Resolving now updates the citizen app immediately and records a late closure (-3% Autho-meter)."
                : "SLA Note: Resolving within the target window boosts the Autho-meter (+2% Authority Trust) and notifies the citizen with your repair photo."}
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="sq-btn primary"
                disabled={resolving || selected.status === "Resolved"}
              >
                <Send size={15} />
                {resolving
                  ? "Uploading Photo & Notifying App..."
                  : "Submit Resolution & Reflect in Citizen App"}
              </button>
              <button
                type="button"
                className="sq-btn ghost"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={15} /> {photoPreview ? "Change Photo" : "Attach Photo"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
