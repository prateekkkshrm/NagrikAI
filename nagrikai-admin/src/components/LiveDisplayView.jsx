import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Activity, CheckCircle2, Clock3, MapPin, Radio, ShieldAlert } from "lucide-react";
import { formatDateTime, getSlaState } from "../adminService";

function FitReportsBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (!coords || coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 15);
    } else {
      map.fitBounds(coords, { padding: [36, 36], maxZoom: 15 });
    }
  }, [map, coords]);
  return null;
}

export default function LiveDisplayView({ reports, authoMeter, onSelectReport }) {
  const geoReports = useMemo(
    () =>
      reports.filter(
        (r) => Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude))
      ),
    [reports]
  );

  const coordsList = useMemo(
    () => geoReports.map((r) => [Number(r.latitude), Number(r.longitude)]),
    [geoReports]
  );

  const regionTitle = useMemo(() => {
    const city = reports.find((r) => r.city)?.city;
    return city ? `${city} Real-Time Operations Wallboard` : "Real-Time Civic Operations Wallboard";
  }, [reports]);

  const counts = useMemo(() => {
    const resolved = reports.filter((r) => r.status === "Resolved").length;
    const fake = reports.filter((r) => r.authenticity_verdict === "fake_report").length;
    const pending = reports.length - resolved - fake;
    const overdue = reports.filter(
      (r) =>
        r.status !== "Resolved" &&
        r.authenticity_verdict !== "fake_report" &&
        getSlaState(r).overdue
    ).length;
    return { resolved, fake, pending, overdue };
  }, [reports]);

  return (
    <div className="live-display-wrap">
      <div className="live-banner">
        <div className="live-banner-left">
          <span className="live-dot-pill">
            <Radio size={13} /> LIVE CIVIC MONITOR
          </span>
          <h3>{regionTitle}</h3>
        </div>
        <div className="live-banner-stats">
          <div className="live-mini-stat">
            <small>PENDING</small>
            <strong>{counts.pending}</strong>
          </div>
          <div className="live-mini-stat">
            <small>RESOLVED</small>
            <strong className="text-emerald">{counts.resolved}</strong>
          </div>
          <div className="live-mini-stat">
            <small>OVERDUE SLA</small>
            <strong className="text-danger">{counts.overdue}</strong>
          </div>
          <div className="live-mini-stat">
            <small>AUTHO-METER</small>
            <strong className="text-teal">
              {authoMeter ? `${authoMeter.authority_trust_pct}%` : "—"}
            </strong>
          </div>
        </div>
      </div>

      <div className="split-grid live-grid">
        <section className="sq-card map-card">
          <div className="sq-card-head">
            <div>
              <h3>Live Incident Map ({geoReports.length})</h3>
              <p className="sq-sub">
                Green = Resolved · Amber = Pending · Red = High Priority / Overdue
              </p>
            </div>
          </div>

          {geoReports.length === 0 ? (
            <div className="sq-empty" style={{ minHeight: 360 }}>
              <MapPin size={30} />
              <strong>Waiting for geo-tagged citizen reports</strong>
              <p>Reports submitted from the NagrikAI mobile app will appear live on this map.</p>
            </div>
          ) : (
            <div className="leaflet-shell">
              <MapContainer
                center={coordsList[0]}
                zoom={13}
                style={{ width: "100%", height: "100%", borderRadius: "12px" }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitReportsBounds coords={coordsList} />
                {geoReports.map((r) => {
                  const sla = getSlaState(r);
                  const isResolved = r.status === "Resolved";
                  const isFake = r.authenticity_verdict === "fake_report";
                  const color = isResolved
                    ? "#10b981"
                    : isFake
                      ? "#64748b"
                      : sla.overdue || r.severity === "High"
                        ? "#ef4444"
                        : "#f59e0b";

                  return (
                    <CircleMarker
                      key={r.id}
                      center={[Number(r.latitude), Number(r.longitude)]}
                      radius={9}
                      pathOptions={{
                        color,
                        fillColor: color,
                        fillOpacity: 0.72,
                        weight: 2,
                      }}
                    >
                      <Popup>
                        <div style={{ minWidth: 180 }}>
                          <strong>
                            #GN-{r.report_number} · {r.category}
                          </strong>
                          <p style={{ margin: "4px 0" }}>{r.title}</p>
                          <small>
                            {r.locality || r.city || "Pinned"} · {r.status}
                          </small>
                          <br />
                          <button
                            type="button"
                            onClick={() => onSelectReport(r.id)}
                            style={{
                              marginTop: 6,
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "none",
                              background: "#0f1c2e",
                              color: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            Inspect Report
                          </button>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
          )}
        </section>

        <section className="sq-card">
          <div className="sq-card-head">
            <div>
              <h3>Live Activity Stream</h3>
              <p className="sq-sub">Newest citizen submissions &amp; authority closures</p>
            </div>
            <Activity size={17} className="text-teal" />
          </div>

          <div className="issue-list">
            {reports.length === 0 ? (
              <div className="sq-empty">
                <Activity size={28} />
                <strong>No live activity yet</strong>
                <p>New reports raised by citizens will stream in here automatically.</p>
              </div>
            ) : (
              reports.slice(0, 15).map((r) => {
                const sla = getSlaState(r);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="issue-row"
                    onClick={() => onSelectReport(r.id)}
                  >
                    <div className="issue-row-top">
                      <span className="issue-num">#GN-{r.report_number}</span>
                      <span className={`sq-pill ${r.status === "Resolved" ? "green" : sla.tone}`}>
                        {r.status === "Resolved" ? (
                          <CheckCircle2 size={11} />
                        ) : sla.overdue ? (
                          <ShieldAlert size={11} />
                        ) : (
                          <Clock3 size={11} />
                        )}
                        {r.status}
                      </span>
                    </div>
                    <div className="issue-title">{r.title}</div>
                    <div className="issue-meta">
                      <span>{r.department}</span>
                      <span>•</span>
                      <span>{formatDateTime(r.created_at)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
