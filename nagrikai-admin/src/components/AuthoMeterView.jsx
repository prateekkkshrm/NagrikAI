import React, { useMemo } from "react";
import {
  CheckCircle2,
  Clock3,
  Gauge,
  Lock,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

export default function AuthoMeterView({ reports, authoMeter }) {
  const stats = useMemo(() => {
    const byCategory = {};
    const trustBuckets = { high: 0, medium: 0, low: 0 };
    let trueCount = 0;
    let fakeCount = 0;
    let unverifiedCount = 0;

    const seenRefs = new Map();

    for (const r of reports) {
      byCategory[r.category] = (byCategory[r.category] || 0) + 1;
      if (r.authenticity_verdict === "true_report") trueCount++;
      else if (r.authenticity_verdict === "fake_report") fakeCount++;
      else unverifiedCount++;

      if (r.reporter_ref && r.reporter_trust_score != null && !seenRefs.has(r.reporter_ref)) {
        seenRefs.set(r.reporter_ref, Number(r.reporter_trust_score));
      }
    }

    for (const score of seenRefs.values()) {
      if (score >= 80) trustBuckets.high++;
      else if (score >= 55) trustBuckets.medium++;
      else trustBuckets.low++;
    }

    const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const maxCat = categories.length > 0 ? categories[0][1] : 1;

    return {
      categories,
      maxCat,
      trustBuckets,
      uniqueCitizens: seenRefs.size,
      trueCount,
      fakeCount,
      unverifiedCount,
    };
  }, [reports]);

  const hasMeter = authoMeter && typeof authoMeter.authority_trust_pct === "number";
  const trustPct = hasMeter ? Number(authoMeter.authority_trust_pct) : 0;
  const totalResolved = Number(authoMeter?.total_resolved ?? 0);
  const onTime = Number(authoMeter?.resolved_on_time_count ?? 0);
  const late = Number(authoMeter?.resolved_late_count ?? 0);
  const avgHrs = Number(authoMeter?.avg_resolution_hours ?? 0);

  const gaugeTone = !hasMeter
    ? "#94a3b8"
    : trustPct >= 75
      ? "#10b981"
      : trustPct >= 50
        ? "#f59e0b"
        : "#ef4444";

  return (
    <div className="analytics-stack">
      <div className="privacy-banner">
        <Lock size={15} />
        <span>
          <strong>Privacy Guard Active (“not user data shared”):</strong> Citizen names, phone numbers, and emails are stripped at the Supabase Edge Function. Only anonymous reporter references (<code>CIT-XXXXXX</code>) and authenticity trust % are tracked.
        </span>
      </div>

      <div className="split-grid">
        <section className="sq-card">
          <div className="sq-card-head">
            <div>
              <h3>Autho-meter · Authority Trust Index</h3>
              <p className="sq-sub">
                Issues resolved on time increase trust % (+2%); delayed resolutions lower it (-3%). Synced live to the NagrikAI citizen app.
              </p>
            </div>
            <Gauge size={20} style={{ color: gaugeTone }} />
          </div>

          <div className="meter-hero">
            <div
              className="meter-ring"
              style={{
                background: `conic-gradient(${gaugeTone} ${trustPct * 3.6}deg, #e2e8f0 0deg)`,
              }}
            >
              <div className="meter-ring-inner">
                <strong>{hasMeter ? `${trustPct}%` : "—"}</strong>
                <span>Trust Score</span>
              </div>
            </div>

            <div className="meter-breakdown">
              <div className="meter-stat-row">
                <span>
                  <CheckCircle2 size={14} className="text-emerald" /> Resolved On Time (+2%)
                </span>
                <strong>{onTime}</strong>
              </div>
              <div className="meter-stat-row">
                <span>
                  <ShieldAlert size={14} className="text-danger" /> Resolved Past SLA (-3%)
                </span>
                <strong>{late}</strong>
              </div>
              <div className="meter-stat-row">
                <span>
                  <Clock3 size={14} className="text-teal" /> Avg Resolution Time
                </span>
                <strong>{avgHrs > 0 ? `${avgHrs} hrs` : "—"}</strong>
              </div>
              <div className="meter-stat-row">
                <span>
                  <TrendingUp size={14} /> Total Closures Tracked
                </span>
                <strong>{totalResolved}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="sq-card">
          <div className="sq-card-head">
            <div>
              <h3>Reporter Authenticity &amp; Trust %</h3>
              <p className="sq-sub">
                True reports raise citizen trust % (+5%); Fake reports lower it (-15%) and reflect live on their citizen profile.
              </p>
            </div>
            <ShieldCheck size={20} className="text-teal" />
          </div>

          <div className="kpi-mini-grid">
            <div className="mini-kpi green">
              <small>VERIFIED TRUE</small>
              <strong>{stats.trueCount}</strong>
              <span>+5% trust boost</span>
            </div>
            <div className="mini-kpi danger">
              <small>FLAGGED FAKE</small>
              <strong>{stats.fakeCount}</strong>
              <span>−15% trust penalty</span>
            </div>
            <div className="mini-kpi">
              <small>AWAITING REVIEW</small>
              <strong>{stats.unverifiedCount}</strong>
              <span>Pending verdict</span>
            </div>
          </div>

          <div className="bar-section">
            <small className="field-label">
              ANONYMOUS REPORTER TRUST DISTRIBUTION ({stats.uniqueCitizens} CITIZEN REFS)
            </small>
            <div className="bar-row">
              <span>High Trust (80–100%)</span>
              <div className="bar-track">
                <div
                  className="bar-fill green"
                  style={{
                    width: `${
                      stats.uniqueCitizens
                        ? (stats.trustBuckets.high / stats.uniqueCitizens) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <b>{stats.trustBuckets.high}</b>
            </div>
            <div className="bar-row">
              <span>Standard (55–79%)</span>
              <div className="bar-track">
                <div
                  className="bar-fill teal"
                  style={{
                    width: `${
                      stats.uniqueCitizens
                        ? (stats.trustBuckets.medium / stats.uniqueCitizens) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <b>{stats.trustBuckets.medium}</b>
            </div>
            <div className="bar-row">
              <span>Low Trust (&lt;55%)</span>
              <div className="bar-track">
                <div
                  className="bar-fill danger"
                  style={{
                    width: `${
                      stats.uniqueCitizens
                        ? (stats.trustBuckets.low / stats.uniqueCitizens) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <b>{stats.trustBuckets.low}</b>
            </div>
          </div>
        </section>
      </div>

      <section className="sq-card">
        <div className="sq-card-head">
          <div>
            <h3>Reports by Civic Category</h3>
            <p className="sq-sub">Live volume across departments from Supabase</p>
          </div>
        </div>
        <div className="bar-section">
          {stats.categories.length === 0 ? (
            <p className="sq-sub">No reports in database yet.</p>
          ) : (
            stats.categories.map(([cat, count]) => (
              <div className="bar-row" key={cat}>
                <span>{cat}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill teal"
                    style={{ width: `${(count / stats.maxCat) * 100}%` }}
                  />
                </div>
                <b>{count}</b>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
