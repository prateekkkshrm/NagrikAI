import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  MessageSquare,
  Mic,
  Calendar,
  Clock,
  Volume2,
  Trash2,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2
} from "lucide-react";
import "./askAI.css";

// Initial realistic default civic conversations if user opens before recording
const DEFAULT_CONVERSATIONS = [
  {
    id: "conv-seed-1",
    timestamp: "26 Nov 2026, 05:15 AM",
    date: new Date(Date.now() - 3600000 * 2).toISOString(),
    userQuery: "What civic services does NagrikAI provide in Greater Noida?",
    aiResponse: "NagrikAI provides real-time civic intelligence across Greater Noida: tracking road hazards with verified database records, routing complaints directly to GNIDA and NPCL with guaranteed SLA resolution, offering GroundTruth AI photo-verification of repairs, and providing smart navigation that bypasses flooded underpasses and Pari Chowk traffic delays.",
    isVoiceNote: false,
    duration: 0,
    language: "English",
    category: "Services Overview"
  },
  {
    id: "conv-seed-2",
    timestamp: "26 Nov 2026, 04:45 AM",
    date: new Date(Date.now() - 3600000 * 4).toISOString(),
    userQuery: "परी चौक पर ट्रैफिक की क्या स्थिति है और बाईपास खुला है?",
    aiResponse: "परी चौक पर वर्तमान में पीक ऑवर के कारण मध्यम यातायात है। सूरजपुर बाईपास कनेक्टर सड़क पर जीएनआईडीए सिविल विभाग द्वारा डामरीकरण कार्य चल रहा है, इसलिए हमने नॉलेज पार्क इनर सर्विस रोड को वैकल्पिक सुगम मार्ग के रूप में अनुशंसित किया है।",
    isVoiceNote: true,
    duration: 6,
    language: "Hindi",
    category: "Traffic & Navigation"
  },
  {
    id: "conv-seed-3",
    timestamp: "25 Nov 2026, 09:30 PM",
    date: new Date(Date.now() - 3600000 * 12).toISOString(),
    userQuery: "How can I report a broken streetlight in Beta I and what is the SLA?",
    aiResponse: "You can file a broken streetlight report in under 30 seconds via the Capture Report screen. Your report is automatically tagged with GPS coordinates and dispatched to the NPCL and GNIDA Electrical Wing. Under municipal guidelines, broken streetlights carry a strict 24-hour repair SLA.",
    isVoiceNote: true,
    duration: 8,
    language: "English",
    category: "Streetlights & SLA"
  }
];

export function AskAIConversations({ go }) {
  const [conversations, setConversations] = useState([]);
  const [filter, setFilter] = useState("all"); // "all", "voicenote", "text", "en", "hi"
  const [activeAudioId, setActiveAudioId] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("nagrikai_ai_conversations");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversations(parsed);
          return;
        }
      }
      // Seed default if empty
      setConversations(DEFAULT_CONVERSATIONS);
      localStorage.setItem("nagrikai_ai_conversations", JSON.stringify(DEFAULT_CONVERSATIONS));
    } catch (e) {
      console.warn("Could not load AI conversations:", e);
      setConversations(DEFAULT_CONVERSATIONS);
    }
  }, []);

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear your Ask AI conversation history?")) {
      localStorage.removeItem("nagrikai_ai_conversations");
      setConversations([]);
    }
  };

  const filteredList = conversations.filter((item) => {
    if (filter === "voicenote") return item.isVoiceNote;
    if (filter === "text") return !item.isVoiceNote;
    if (filter === "en") return item.language === "English";
    if (filter === "hi") return item.language === "Hindi";
    return true;
  });

  return (
    <div className="page ask-ai-conversations-screen">
      {/* Top Header */}
      <div className="topbar">
        <button className="icon-btn" onClick={() => go("Profile")}>
          <ChevronLeft size={19} />
        </button>
        <b>Ask AI Conversations</b>
        {conversations.length > 0 && (
          <button
            className="icon-btn"
            onClick={handleClearHistory}
            title="Clear all conversation history"
            style={{ color: "#ef4444" }}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="eyebrow">CITIZEN PROFILE • AI DIALOGUE HISTORY</div>
      <h1>Your AI conversations.<br />Every voice & text.</h1>
      <p className="muted" style={{ marginBottom: "16px" }}>
        Review your complete record of queries, voice notes, language transcripts, and AI municipal responses.
      </p>

      {/* Overview Stat Cards */}
      <div className="conv-stats-grid">
        <div className="conv-stat-card">
          <strong>{conversations.length}</strong>
          <small>Total Chats</small>
        </div>
        <div className="conv-stat-card">
          <strong style={{ color: "#28d7a0" }}>
            {conversations.filter(c => c.isVoiceNote).length}
          </strong>
          <small>Voice Notes</small>
        </div>
        <div className="conv-stat-card">
          <strong style={{ color: "#38bdf8" }}>
            {conversations.filter(c => c.language === "Hindi").length}
          </strong>
          <small>हिन्दी Queries</small>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="conv-filter-row">
        {[
          ["all", "All Conversations"],
          ["voicenote", "🎤 Voice Notes"],
          ["text", "💬 Text Chats"],
          ["hi", "हिन्दी (Hindi)"],
          ["en", "English"]
        ].map(([key, label]) => (
          <button
            key={key}
            className={`conv-filter-btn ${filter === key ? "active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Conversations Stream */}
      {filteredList.length === 0 ? (
        <div className="conv-empty-box">
          <MessageSquare size={36} style={{ color: "#475569", marginBottom: "12px" }} />
          <h3>No conversations found</h3>
          <p className="muted">
            {filter === "all"
              ? "You haven't chatted with NagrikAI yet. Send a text or record a voice note to get started!"
              : "No conversations match the selected filter."}
          </p>
          <button className="btn" style={{ marginTop: "12px" }} onClick={() => go("Ask NagrikAI")}>
            Start a Conversation with AI
          </button>
        </div>
      ) : (
        <div className="conv-cards-list">
          {filteredList.map((conv) => (
            <div key={conv.id} className="conv-card">
              {/* Card Meta Top */}
              <div className="conv-card-top">
                <div className="conv-card-time">
                  <Clock size={11} />
                  <span>{conv.timestamp}</span>
                </div>
                <div className="conv-card-badges">
                  <span className={`conv-type-badge ${conv.isVoiceNote ? "voice" : "text"}`}>
                    {conv.isVoiceNote ? `🎤 Voice Note (${conv.duration || 1}s)` : "💬 Text"}
                  </span>
                  <span className={`conv-lang-badge ${conv.language === "Hindi" ? "hi" : "en"}`}>
                    {conv.language === "Hindi" ? "हिन्दी" : "English"}
                  </span>
                </div>
              </div>

              {/* Citizen Query / Transcript Section */}
              <div className="conv-query-section">
                <div className="conv-section-label">
                  <span>CITIZEN TRANSCRIPT</span>
                  {conv.category && <span className="conv-category-tag">{conv.category}</span>}
                </div>
                <p className="conv-query-text">
                  "{conv.userQuery}"
                </p>
              </div>

              {/* AI Model Response Section */}
              <div className="conv-response-section">
                <div className="conv-section-label" style={{ color: "#28d7a0" }}>
                  <Sparkles size={11} style={{ marginRight: "4px" }} />
                  <span>NAGRIKAI RESPONSE</span>
                </div>
                <p className="conv-response-text">
                  {conv.aiResponse}
                </p>
              </div>

              {/* Action Bar */}
              <div className="conv-card-footer">
                <button
                  className="conv-reopen-btn"
                  onClick={() => {
                    localStorage.setItem("nagrikai_pending_reopen_query", conv.userQuery);
                    go("Ask NagrikAI");
                  }}
                >
                  <span>Continue in Ask AI</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating CTA */}
      <div style={{ marginTop: "24px", marginBottom: "16px" }}>
        <button className="btn" onClick={() => go("Ask NagrikAI")}>
          Ask NagrikAI a New Question
        </button>
      </div>
    </div>
  );
}

export default AskAIConversations;
