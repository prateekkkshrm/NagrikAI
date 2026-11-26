import React, { useState } from "react";
import { Bot, Send, Sparkles } from "lucide-react";
import { askAiAssistant, getSlaState } from "../adminService";

export default function AiAssistantView({ session, reports, selectedReportId, onSelectReport }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      provider: "NagrikAI Ops Co-Pilot",
      text: "Select any live report from Supabase or ask a question below. I can analyze SLA urgency, inspect GroundTruth fake-report signals, recommend the right department, and draft citizen resolution messages.",
    },
  ]);

  const selected = reports.find((r) => r.id === selectedReportId) || null;

  const runQuery = async (customText) => {
    const q = (customText ?? prompt).trim();
    if (!q && !selected) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: q || `Analyze #GN-${selected.report_number}: ${selected.title}`,
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setPrompt("");
    setLoading(true);

    try {
      const res = await askAiAssistant(session, {
        reportId: selected?.id || null,
        prompt: q,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          provider: res.provider === "gemini" ? "Gemini Ops AI" : "NagrikAI Triage",
          text: res.reply,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          provider: "System",
          text: err.message || "AI assistant could not respond.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="split-grid">
      <section className="sq-card">
        <div className="sq-card-head">
          <div>
            <h3>Context Report (Optional)</h3>
            <p className="sq-sub">Click a live report to focus the AI co-pilot</p>
          </div>
          <Sparkles size={18} className="text-teal" />
        </div>

        <div className="issue-list">
          <button
            type="button"
            className={`issue-row ${!selected ? "active" : ""}`}
            onClick={() => onSelectReport(null)}
          >
            <div className="issue-title">All Pending Queue (City-wide Triage)</div>
            <div className="issue-meta">Summarize priorities &amp; overdue SLAs</div>
          </button>

          {reports.slice(0, 15).map((r) => {
            const sla = getSlaState(r);
            return (
              <button
                key={r.id}
                type="button"
                className={`issue-row ${selected?.id === r.id ? "active" : ""}`}
                onClick={() => onSelectReport(r.id)}
              >
                <div className="issue-row-top">
                  <span className="issue-num">#GN-{r.report_number}</span>
                  <span className={`sq-pill ${sla.tone}`}>{sla.label}</span>
                </div>
                <div className="issue-title">{r.title}</div>
                <div className="issue-meta">
                  {r.category} · {[r.locality, r.city].filter(Boolean).join(", ") || "Pinned"}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="sq-card ai-chat-card">
        <div className="sq-card-head">
          <div>
            <h3>AI to Help Admin</h3>
            <p className="sq-sub">
              {selected
                ? `Focused on #GN-${selected.report_number} (${selected.category})`
                : "Focused on entire active civic queue"}
            </p>
          </div>
          <Bot size={20} className="text-teal" />
        </div>

        <div className="quick-prompts">
          {[
            "Summarize priority & SLA risk",
            "Check authenticity / fake report signals",
            "Draft resolution message for citizen",
          ].map((qp) => (
            <button
              key={qp}
              type="button"
              className="sq-chip"
              onClick={() => runQuery(qp)}
              disabled={loading}
            >
              {qp}
            </button>
          ))}
        </div>

        <div className="ai-messages">
          {messages.map((m) => (
            <div key={m.id} className={`ai-bubble ${m.role}`}>
              {m.provider && <small className="ai-provider">{m.provider}</small>}
              <pre className="ai-pre">{m.text}</pre>
            </div>
          ))}
          {loading && <div className="ai-bubble assistant">Analyzing live Supabase data...</div>}
        </div>

        <form
          className="ai-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            runQuery();
          }}
        >
          <input
            type="text"
            className="sq-input"
            placeholder="Ask AI to prioritize, draft a reply, or evaluate a report..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button type="submit" className="sq-btn primary" disabled={loading}>
            <Send size={15} /> Ask AI
          </button>
        </form>
      </section>
    </div>
  );
}
