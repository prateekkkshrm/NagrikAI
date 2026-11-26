import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileWarning,
  Gauge,
  History as HistoryIcon,
  Home,
  Inbox,
  Lock,
  LogOut,
  MapPin,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import {
  fetchDashboardData,
  filterReportsByPeriod,
  formatDateTime,
  getSavedSession,
  getSlaState,
  loginAdmin,
  resolveReportIssue,
  saveSession,
  updateReportStatus,
  verifyReportAuthenticity,
} from "./adminService";
import IssueFixedView from "./components/IssueFixedView";
import LiveDisplayView from "./components/LiveDisplayView";
import AuthoMeterView from "./components/AuthoMeterView";
import AiAssistantView from "./components/AiAssistantView";

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: Home },
  { id: "raised", label: "Reports Raised", icon: Inbox },
  { id: "fixed", label: "Issue Fixed", icon: Wrench },
  { id: "live", label: "Live Display", icon: Radio },
  { id: "autho", label: "Autho-meter & Analytics", icon: Gauge },
  { id: "ai", label: "AI Assistant", icon: Bot },
  { id: "history", label: "History", icon: HistoryIcon },
];

const PERIOD_TABS = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "total", label: "Total" },
];

const CATEGORIES = ["All", "Roads", "Water", "Waste", "Street lighting", "Other"];

function LoginScreen({ onSuccess }) {
  const [username, setUsername] = useState("admin01");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await loginAdmin(username, password);
      onSuccess(session);
    } catch (err) {
      setError(err.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-badge">NA</div>
          <div>
            <h1>NagrikAI</h1>
            <p>Civic Operations Command</p>
          </div>
        </div>

        <h2 className="login-title">Admin Desk Sign-In</h2>
        <p className="login-sub">
          Connects live to your NagrikAI Supabase database to inspect citizen reports, verify authenticity, and upload repair proof back to the mobile app.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <label className="field-label" htmlFor="admin-user">
              ADMIN ID
            </label>
            <input
              id="admin-user"
              className="sq-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin01"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="admin-pass">
              PASSWORD
            </label>
            <input
              id="admin-pass"
              type="password"
              className="sq-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              autoComplete="current-password"
            />
          </div>

          {error && <div className="sq-alert danger">{error}</div>}

          <button type="submit" className="sq-btn primary" disabled={loading}>
            <Lock size={15} />
            {loading ? "Connecting to Supabase..." : "Sign in to Admin Dashboard"}
          </button>
        </form>

        <div className="login-hint">
          <ShieldCheck size={15} className="text-teal" />
          <span>
            Privacy enforced: Citizen names, phone numbers &amp; emails are never exposed to the admin portal.
          </span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(() => getSavedSession());
  const [activeTab, setActiveTab] = useState("home");
  const [period, setPeriod] = useState("total");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState([]);
  const [authoMeter, setAuthoMeter] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [authNote, setAuthNote] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(window.__adminToastTimer);
    window.__adminToastTimer = window.setTimeout(() => setToast(""), 3200);
  };

  const refreshData = useCallback(
    async ({ silent = false } = {}) => {
      if (!session) return;
      if (!silent) setLoading(true);
      try {
        const res = await fetchDashboardData(session);
        setReports(res.reports);
        setAuthoMeter(res.authoMeter);
        setHistory(res.history);
        setSyncError("");
        setLastSyncedAt(new Date());
        setSelectedReportId((prev) =>
          prev && res.reports.some((r) => r.id === prev)
            ? prev
            : res.reports[0]?.id || null
        );
      } catch (err) {
        if (err.status === 401) {
          saveSession(null);
          setSession(null);
        } else {
          setSyncError(err.message || "Could not sync with Supabase.");
          if (!silent) showToast(err.message || "Could not refresh data.");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [session]
  );

  useEffect(() => {
    if (!session) return;
    refreshData();
    const poll = window.setInterval(() => {
      refreshData({ silent: true });
    }, 8000);
    return () => window.clearInterval(poll);
  }, [session, refreshData]);

  const handleLogout = () => {
    saveSession(null);
    setSession(null);
    setReports([]);
    setHistory([]);
    setAuthoMeter(null);
    setSyncError("");
  };

  const periodReports = useMemo(
    () => filterReportsByPeriod(reports, period),
    [reports, period]
  );

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = periodReports.filter((r) => {
      const isResolved = r.status === "Resolved";
      const isFake = r.authenticity_verdict === "fake_report";
      const isPending = !isResolved && !isFake;

      if (statusFilter === "pending" && !isPending) return false;
      if (statusFilter === "resolved" && !isResolved) return false;
      if (statusFilter === "fake" && !isFake) return false;
      if (categoryFilter !== "All" && r.category !== categoryFilter) return false;

      if (!q) return true;
      return (
        String(r.report_number).includes(q) ||
        String(r.title || "").toLowerCase().includes(q) ||
        String(r.category || "").toLowerCase().includes(q) ||
        String(r.locality || "").toLowerCase().includes(q) ||
        String(r.city || "").toLowerCase().includes(q) ||
        String(r.reporter_ref || "").toLowerCase().includes(q)
      );
    });

    if (sortBy === "sla") {
      return [...list].sort((a, b) => getSlaState(a).hoursLeft - getSlaState(b).hoursLeft);
    }
    if (sortBy === "confirmed") {
      return [...list].sort(
        (a, b) => Number(b.confirm_count || 0) - Number(a.confirm_count || 0)
      );
    }
    return list;
  }, [periodReports, statusFilter, categoryFilter, sortBy, search]);

  const metrics = useMemo(() => {
    const raised = periodReports.length;
    const resolved = periodReports.filter((r) => r.status === "Resolved").length;
    const fake = periodReports.filter((r) => r.authenticity_verdict === "fake_report").length;
    const pending = raised - resolved - fake;
    const overdue = periodReports.filter(
      (r) =>
        r.status !== "Resolved" &&
        r.authenticity_verdict !== "fake_report" &&
        getSlaState(r).overdue
    ).length;
    return { raised, pending, resolved, fake, overdue };
  }, [periodReports]);

  const selectedReport = useMemo(
    () =>
      filteredReports.find((r) => r.id === selectedReportId) ||
      reports.find((r) => r.id === selectedReportId) ||
      filteredReports[0] ||
      null,
    [filteredReports, reports, selectedReportId]
  );

  const urgentNotifications = useMemo(() => {
    return reports
      .filter((r) => r.status !== "Resolved" && r.authenticity_verdict !== "fake_report")
      .slice(0, 5);
  }, [reports]);

  const handleDispatchCrew = async (reportId) => {
    setActionBusy(true);
    try {
      await updateReportStatus(session, {
        reportId,
        status: "In Progress",
        note: "Field maintenance crew dispatched by Admin Desk.",
      });
      await refreshData();
      showToast("Marked In Progress — citizen notified in NagrikAI app.");
    } catch (err) {
      showToast(err.message || "Could not update status.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleVerifyAuthenticity = async (reportId, verdict) => {
    setActionBusy(true);
    try {
      const res = await verifyReportAuthenticity(session, {
        reportId,
        verdict,
        note: authNote.trim(),
      });
      setAuthNote("");
      await refreshData();
      showToast(
        verdict === "true_report"
          ? `Marked True Report (+5% citizen trust → ${res.reporterTrustScore}%). Synced to app.`
          : `Flagged Fake Report (−15% citizen trust → ${res.reporterTrustScore}%). Synced to app.`
      );
    } catch (err) {
      showToast(err.message || "Could not update authenticity verdict.");
    } finally {
      setActionBusy(false);
    }
  };

  const handleResolveSubmit = async (payload) => {
    setActionBusy(true);
    try {
      const res = await resolveReportIssue(session, payload);
      await refreshData();
      showToast(
        `Issue resolved & repair photo published to citizen app! Autho-meter: ${res.authorityTrustPct}%.`
      );
      return true;
    } catch (err) {
      showToast(err.message || "Resolution failed.");
      return false;
    } finally {
      setActionBusy(false);
    }
  };

  if (!session) {
    return <LoginScreen onSuccess={(nextSession) => setSession(nextSession)} />;
  }

  const todayLabel = new Date()
    .toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    })
    .toUpperCase();

  const activeNavMeta = NAV_ITEMS.find((n) => n.id === activeTab) || NAV_ITEMS[0];

  return (
    <div className="admin-shell">
      {/* Dark Navy Sidebar (ScholarQueue style) */}
      <aside className="sq-sidebar">
        <div className="sidebar-brand">
          <div className="brand-badge">NA</div>
          <div>
            <h2>NagrikAI</h2>
            <small>Civic Admin Portal</small>
          </div>
        </div>

        <div className="sidebar-mode">
          <div className="mode-line">
            <span className={`mode-dot ${!syncError ? "live" : ""}`} />
            <span>{!syncError ? "Live Supabase" : "Connection issue"}</span>
          </div>
          <small>
            {lastSyncedAt
              ? `Auto-synced at ${lastSyncedAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}`
              : "Connecting to live DB..."}
          </small>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`nav-item ${activeTab === id ? "active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
              {id === "raised" && (
                <span className="nav-badge">{reports.length}</span>
              )}
              {id === "fixed" && metrics.pending > 0 && (
                <span className="nav-badge">{metrics.pending}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Lock size={15} className="text-teal" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <strong>Privacy Guard</strong>
            <small>Zero citizen PII shared</small>
          </div>
        </div>
      </aside>

      {/* Light Workspace Canvas */}
      <div className="sq-main">
        <header className="sq-topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{activeNavMeta.label}</strong>
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="icon-pill-btn"
              onClick={() => refreshData()}
              title="Refresh live Supabase data"
            >
              <RefreshCw size={15} className={loading ? "spin" : ""} />
            </button>

            <button
              type="button"
              className="icon-pill-btn"
              onClick={() => setNotifOpen((o) => !o)}
              title="Incoming report alerts"
            >
              <Bell size={16} />
              {urgentNotifications.length > 0 && <span className="bell-dot" />}
            </button>

            {notifOpen && (
              <div className="notif-popover">
                <div className="notif-popover-head">
                  <strong>Latest Civic Alerts ({urgentNotifications.length})</strong>
                  <button
                    type="button"
                    className="sq-btn ghost sm"
                    onClick={() => setNotifOpen(false)}
                  >
                    Close
                  </button>
                </div>
                {urgentNotifications.length === 0 ? (
                  <p className="sq-sub">No open citizen reports awaiting action.</p>
                ) : (
                  urgentNotifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className="notif-item"
                      onClick={() => {
                        setSelectedReportId(n.id);
                        setActiveTab("raised");
                        setNotifOpen(false);
                      }}
                    >
                      <strong>
                        #GN-{n.report_number} · {n.category}
                      </strong>
                      <small>{n.title}</small>
                    </button>
                  ))
                )}
              </div>
            )}

            <div className="admin-pill">
              <div className="admin-avatar">AD</div>
              <div className="admin-pill-text">
                <strong>{session?.admin?.username || "admin01"}</strong>
                <small>Admin Desk</small>
              </div>
            </div>

            <button
              type="button"
              className="icon-pill-btn"
              onClick={handleLogout}
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        <main className="sq-workspace">
          {syncError && (
            <div className="sq-alert danger">
              <strong>Supabase Sync Error:</strong> {syncError}
            </div>
          )}

          {/* Hero Title Row */}
          <div className="hero-header">
            <div>
              <div className="date-live-row">
                <span>{todayLabel}</span>
                <span className="live-chip">
                  <i /> Live Auto-Sync
                </span>
              </div>
              <h1>
                {activeTab === "home"
                  ? "Welcome to NagrikAI Admin Dashboard"
                  : activeNavMeta.label}
              </h1>
              <p>
                {activeTab === "home"
                  ? "Live bidirectional sync with the NagrikAI citizen app — inspect incoming reports, verify authenticity, and upload repair proof."
                  : activeTab === "raised"
                    ? "Inspect citizen photo evidence, check GroundTruth AI signals, dispatch crews, or flag fake reports."
                    : activeTab === "fixed"
                      ? "Select an open report, upload the after-repair photo, and send resolution proof directly to the citizen app."
                      : activeTab === "live"
                        ? "Real-time geo-tagged civic incident map and live status stream."
                        : activeTab === "autho"
                          ? "Track Authority Autho-meter trust % and anonymous citizen authenticity scores."
                          : activeTab === "ai"
                            ? "AI co-pilot for prioritizing urgent reports, verifying evidence, and drafting replies."
                            : "Chronological audit trail of admin resolutions and authenticity reviews."}
              </p>
            </div>

            <button
              type="button"
              className="autho-quick-badge"
              onClick={() => setActiveTab("autho")}
            >
              <Gauge size={22} className="text-teal" />
              <div style={{ textAlign: "left" }}>
                <strong>
                  {authoMeter ? `${authoMeter.authority_trust_pct}%` : "—"}
                </strong>
                <small>Autho-meter Trust</small>
              </div>
            </button>
          </div>

          {/* 3 KPI Stat Cards (ScholarQueue + Whiteboard) */}
          {(activeTab === "home" || activeTab === "raised") && (
            <>
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-icon teal">
                    <Inbox size={19} />
                  </div>
                  <div className="kpi-body">
                    <small>Reports Raised</small>
                    <strong>{metrics.raised}</strong>
                    <span>
                      Period: {PERIOD_TABS.find((p) => p.id === period)?.label}
                    </span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon amber">
                    <Clock3 size={19} />
                  </div>
                  <div className="kpi-body">
                    <small>Reports Pending</small>
                    <strong>{metrics.pending}</strong>
                    <span>
                      {metrics.overdue > 0
                        ? `${metrics.overdue} overdue SLA`
                        : "All within SLA"}
                    </span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-icon green">
                    <CheckCircle2 size={19} />
                  </div>
                  <div className="kpi-body">
                    <small>Resolved</small>
                    <strong>{metrics.resolved}</strong>
                    <span>
                      {metrics.fake} flagged fake · Synced to citizen app
                    </span>
                  </div>
                </div>
              </div>

              {/* Control Bar */}
              <div className="controls-card">
                <div className="controls-left">
                  <strong>Report &amp; Queue Controls</strong>
                  <small>
                    Filter by period, status (Pend/Res), category, or urgency
                  </small>
                </div>

                <div className="controls-right">
                  <div className="pill-group" role="tablist" aria-label="Time period">
                    {PERIOD_TABS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`pill-tab ${period === t.id ? "active" : ""}`}
                        onClick={() => setPeriod(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <div className="pill-group" role="tablist" aria-label="Status filter">
                    {[
                      ["all", "All"],
                      ["pending", "Pending"],
                      ["resolved", "Resolved"],
                      ["fake", "Fake"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={`pill-tab ${statusFilter === id ? "active" : ""}`}
                        onClick={() => setStatusFilter(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <select
                    className="sq-select"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    aria-label="Category filter"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c === "All" ? "All Categories" : c}
                      </option>
                    ))}
                  </select>

                  <select
                    className="sq-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    aria-label="Sort order"
                  >
                    <option value="newest">Sort: Newest</option>
                    <option value="sla">Sort: SLA Urgency</option>
                    <option value="confirmed">Sort: Most Confirmed</option>
                  </select>

                  <div className="search-box">
                    <Search size={14} color="#64748b" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search #GN, area, title..."
                    />
                  </div>

                  <button
                    type="button"
                    className="sq-btn primary"
                    onClick={() => {
                      if (selectedReport) setSelectedReportId(selectedReport.id);
                      setActiveTab("fixed");
                    }}
                  >
                    <Wrench size={14} /> Issue Fixed
                  </button>
                </div>
              </div>

              {/* Split Workspace: Latest Issues + Photo & Details Inspector */}
              <div className="split-grid">
                <section className="sq-card">
                  <div className="sq-card-head">
                    <div>
                      <h3>
                        {activeTab === "home" ? "Latest Issues" : "Reports Queue"}
                      </h3>
                      <p className="sq-sub">
                        {filteredReports.length} live Supabase report
                        {filteredReports.length === 1 ? "" : "s"} (anonymized)
                      </p>
                    </div>
                  </div>

                  <div className="issue-list">
                    {filteredReports.length === 0 ? (
                      <div className="sq-empty">
                        <Inbox size={28} />
                        <strong>
                          {reports.length === 0
                            ? "No reports submitted yet"
                            : "No matching reports"}
                        </strong>
                        <p>
                          {reports.length === 0
                            ? "When a citizen raises an issue in the NagrikAI mobile app, it will appear here automatically."
                            : "Try adjusting the period, status, or category filter above."}
                        </p>
                      </div>
                    ) : (
                      filteredReports.map((r) => {
                        const sla = getSlaState(r);
                        const isSelected = selectedReport?.id === r.id;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            className={`issue-row ${isSelected ? "active" : ""}`}
                            onClick={() => setSelectedReportId(r.id)}
                          >
                            <div className="issue-row-top">
                              <span className="issue-num">
                                #GN-{r.report_number} · {r.category}
                              </span>
                              <div style={{ display: "flex", gap: 6 }}>
                                {r.authenticity_verdict === "fake_report" && (
                                  <span className="sq-pill danger">Fake</span>
                                )}
                                {r.authenticity_verdict === "true_report" && (
                                  <span className="sq-pill green">True</span>
                                )}
                                <span
                                  className={`sq-pill ${
                                    r.status === "Resolved" ? "green" : sla.tone
                                  }`}
                                >
                                  {r.status === "Resolved" ? "Resolved" : sla.label}
                                </span>
                              </div>
                            </div>
                            <div className="issue-title">{r.title}</div>
                            <div className="issue-meta">
                              <span>
                                {[r.locality, r.city].filter(Boolean).join(", ") || "Pinned"}
                              </span>
                              <span>•</span>
                              <span>Severity: {r.severity}</span>
                              <span>•</span>
                              <span>
                                {r.reporter_ref} ({r.reporter_trust_score}% trust)
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* Right Panel: Photo & Details + Crew Dispatch + Fake/True Check */}
                <section className="sq-card">
                  <div className="sq-card-head">
                    <div>
                      <h3>Photo &amp; Report Details</h3>
                      <p className="sq-sub">
                        Click any photo to zoom · All updates reflect live in citizen app
                      </p>
                    </div>
                    {selectedReport && (
                      <span className="sq-pill teal">{selectedReport.status}</span>
                    )}
                  </div>

                  {!selectedReport ? (
                    <div className="sq-empty">
                      <FileWarning size={28} />
                      <strong>No report selected</strong>
                      <p>Select a report from the list to inspect photo evidence and details.</p>
                    </div>
                  ) : (
                    <div className="detail-stack">
                      <div>
                        <small className="field-label">
                          #GN-{selectedReport.report_number} · {selectedReport.department}
                        </small>
                        <h3 style={{ margin: "2px 0 6px" }}>{selectedReport.title}</h3>
                        <p className="sq-sub">{selectedReport.description}</p>
                      </div>

                      <div className="photo-compare-grid">
                        <div className="photo-box">
                          <small className="field-label">BEFORE · CITIZEN PHOTO</small>
                          {selectedReport.photo_url ? (
                            <img
                              src={selectedReport.photo_url}
                              alt={selectedReport.title}
                              className="evidence-img clickable"
                              onClick={() =>
                                setLightbox({
                                  url: selectedReport.photo_url,
                                  title: `Before · #GN-${selectedReport.report_number}`,
                                })
                              }
                            />
                          ) : (
                            <div className="photo-empty">
                              No citizen photo attached
                            </div>
                          )}
                        </div>

                        {(selectedReport.status === "Resolved" ||
                          selectedReport.resolution_photo_url) && (
                          <div className="photo-box">
                            <small className="field-label">AFTER · AUTHORITY REPAIR PHOTO</small>
                            {selectedReport.resolution_photo_url ? (
                              <img
                                src={selectedReport.resolution_photo_url}
                                alt="After repair"
                                className="evidence-img clickable"
                                onClick={() =>
                                  setLightbox({
                                    url: selectedReport.resolution_photo_url,
                                    title: `After Repair · #GN-${selectedReport.report_number}`,
                                  })
                                }
                              />
                            ) : (
                              <div className="photo-empty">
                                Resolved without photo
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {Array.isArray(selectedReport.evidence_items) &&
                        selectedReport.evidence_items.length > 0 && (
                          <div>
                            <small className="field-label">
                              ADDITIONAL EVIDENCE ({selectedReport.evidence_items.length})
                            </small>
                            <div className="extra-evidence-strip">
                              {selectedReport.evidence_items.map((ev) =>
                                ev.photo_url ? (
                                  <img
                                    key={ev.id}
                                    src={ev.photo_url}
                                    alt={ev.note || "Supporting evidence"}
                                    title={ev.note || ev.evidence_role}
                                    className="evidence-thumb clickable"
                                    onClick={() =>
                                      setLightbox({
                                        url: ev.photo_url,
                                        title: `${ev.evidence_role || "Evidence"} · #GN-${selectedReport.report_number}`,
                                      })
                                    }
                                  />
                                ) : null
                              )}
                            </div>
                          </div>
                        )}

                      <div className="info-grid">
                        <div className="info-tile">
                          <small>LOCATION (NO USER PII)</small>
                          <strong>
                            <MapPin size={12} style={{ verticalAlign: "middle" }} />{" "}
                            {[selectedReport.locality, selectedReport.city, selectedReport.state]
                              .filter(Boolean)
                              .join(", ") ||
                              `${Number(selectedReport.latitude).toFixed(4)}, ${Number(selectedReport.longitude).toFixed(4)}`}
                          </strong>
                        </div>
                        <div className="info-tile">
                          <small>ANONYMOUS REPORTER REF</small>
                          <strong>
                            {selectedReport.reporter_ref} · Trust{" "}
                            {selectedReport.reporter_trust_score}%
                          </strong>
                        </div>
                        <div className="info-tile">
                          <small>COMMUNITY GROUNDTRUTH</small>
                          <strong>
                            {selectedReport.confirm_count || 0} confirmed ·{" "}
                            {selectedReport.dispute_count || 0} disputed
                          </strong>
                        </div>
                        <div className="info-tile">
                          <small>AI ADVISORY VERDICT</small>
                          <strong>
                            {selectedReport.latest_assessment?.verdict ||
                              selectedReport.ai_status ||
                              "pending"}
                            {selectedReport.latest_assessment?.confidence_score != null
                              ? ` (${selectedReport.latest_assessment.confidence_score}%)`
                              : ""}
                          </strong>
                        </div>
                      </div>

                      {selectedReport.resolution_note && (
                        <div className="sla-impact-note">
                          <strong>Resolution Note:</strong> {selectedReport.resolution_note}{" "}
                          <span>({formatDateTime(selectedReport.resolved_at)})</span>
                        </div>
                      )}

                      <div className="auth-box">
                        <div className="issue-row-top">
                          <strong>
                            <ShieldAlert size={14} style={{ verticalAlign: "middle" }} />{" "}
                            Actions &amp; Authenticity Check
                          </strong>
                          <span
                            className={`sq-pill ${
                              selectedReport.authenticity_verdict === "true_report"
                                ? "green"
                                : selectedReport.authenticity_verdict === "fake_report"
                                  ? "danger"
                                  : "amber"
                            }`}
                          >
                            {selectedReport.authenticity_verdict === "true_report"
                              ? "Verified True"
                              : selectedReport.authenticity_verdict === "fake_report"
                                ? "Flagged Fake"
                                : "Unverified"}
                          </span>
                        </div>

                        <input
                          className="sq-input"
                          placeholder="Optional verification remark..."
                          value={authNote}
                          onChange={(e) => setAuthNote(e.target.value)}
                        />

                        <div className="auth-actions">
                          {selectedReport.status !== "Resolved" &&
                            selectedReport.status !== "In Progress" &&
                            selectedReport.authenticity_verdict !== "fake_report" && (
                              <button
                                type="button"
                                className="sq-btn ghost sm"
                                disabled={actionBusy}
                                onClick={() => handleDispatchCrew(selectedReport.id)}
                              >
                                <Truck size={14} /> Dispatch Crew (In Progress)
                              </button>
                            )}

                          <button
                            type="button"
                            className="sq-btn success sm"
                            disabled={actionBusy}
                            onClick={() =>
                              handleVerifyAuthenticity(selectedReport.id, "true_report")
                            }
                          >
                            <ShieldCheck size={14} /> True Report (+5% Trust)
                          </button>

                          <button
                            type="button"
                            className="sq-btn danger sm"
                            disabled={actionBusy}
                            onClick={() =>
                              handleVerifyAuthenticity(selectedReport.id, "fake_report")
                            }
                          >
                            <AlertTriangle size={14} /> Fake Report (−15% Trust)
                          </button>

                          <button
                            type="button"
                            className="sq-btn ghost sm"
                            onClick={() => setActiveTab("ai")}
                          >
                            <Sparkles size={14} /> Ask AI Co-Pilot
                          </button>

                          {selectedReport.status !== "Resolved" &&
                            selectedReport.authenticity_verdict !== "fake_report" && (
                              <button
                                type="button"
                                className="sq-btn teal sm"
                                onClick={() => setActiveTab("fixed")}
                              >
                                <Wrench size={14} /> Upload Repair Photo
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </>
          )}

          {activeTab === "fixed" && (
            <IssueFixedView
              reports={reports}
              selectedReportId={selectedReportId}
              onSelectReport={setSelectedReportId}
              onResolveSubmit={handleResolveSubmit}
              onPreviewPhoto={setLightbox}
              resolving={actionBusy}
            />
          )}

          {activeTab === "live" && (
            <LiveDisplayView
              reports={reports}
              authoMeter={authoMeter}
              onSelectReport={(id) => {
                setSelectedReportId(id);
                setActiveTab("raised");
              }}
            />
          )}

          {activeTab === "autho" && (
            <AuthoMeterView reports={reports} authoMeter={authoMeter} />
          )}

          {activeTab === "ai" && (
            <AiAssistantView
              session={session}
              reports={reports}
              selectedReportId={selectedReportId}
              onSelectReport={setSelectedReportId}
            />
          )}

          {activeTab === "history" && (
            <section className="sq-card">
              <div className="sq-card-head">
                <div>
                  <h3>Audit &amp; Resolution History</h3>
                  <p className="sq-sub">
                    Every submitted, dispatched, verified, and resolved event from Supabase
                  </p>
                </div>
                <span className="sq-pill">{history.length} events</span>
              </div>

              <div className="history-list">
                {history.length === 0 ? (
                  <div className="sq-empty">
                    <HistoryIcon size={28} />
                    <strong>No history events yet</strong>
                    <p>Citizen submissions and admin actions will appear here.</p>
                  </div>
                ) : (
                  history.map((h) => (
                    <div key={h.id} className="history-row">
                      <div>
                        <strong>{h.title}</strong>
                        {h.details && <p className="sq-sub">{h.details}</p>}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <span className="sq-pill teal">
                          {String(h.actor_type || "system").toUpperCase()}
                        </span>
                        <div className="sq-sub" style={{ marginTop: 4 }}>
                          {formatDateTime(h.created_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </main>
      </div>

      {lightbox && (
        <div className="lightbox-backdrop" onClick={() => setLightbox(null)}>
          <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-head">
              <strong>{lightbox.title}</strong>
              <button
                type="button"
                className="icon-pill-btn"
                onClick={() => setLightbox(null)}
              >
                <X size={16} />
              </button>
            </div>
            <img src={lightbox.url} alt={lightbox.title} className="lightbox-img" />
          </div>
        </div>
      )}

      {toast && <div className="sq-toast">{toast}</div>}
    </div>
  );
}
