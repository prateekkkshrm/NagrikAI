import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  MessageSquare,
  Clock,
  Trash2,
  Sparkles,
  ArrowRight
} from "lucide-react";
import {
  getAuthenticatedUser,
  loadOwnConversations,
  deleteOwnConversations,
  PENDING_CONVERSATION_KEY,
  START_NEW_CONVERSATION_KEY,
  activeConversationKey
} from "./aiConversationStore";
import "./askAI.css";

export function AskAIConversations({ go }) {
  const [conversations, setConversations] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const user = await getAuthenticatedUser();
        if (!active) return;

        setCurrentUser(user);

        const result = await loadOwnConversations(user.id);
        if (!active) return;

        const messageGroups = {};

        (result.messages || []).forEach(message => {
          if (!messageGroups[message.conversation_id]) {
            messageGroups[message.conversation_id] = [];
          }

          messageGroups[message.conversation_id].push(message);
        });

        const formatted = (result.conversations || []).map(conversation => {
          const thread = messageGroups[conversation.id] || [];

          const lastUserIndex = thread.reduce(
            (last, message, index) =>
              message.role === "user" ? index : last,
            -1
          );

          const lastUser =
            lastUserIndex >= 0 ? thread[lastUserIndex] : null;

          const lastAssistant =
            lastUserIndex >= 0
              ? thread.slice(lastUserIndex + 1).find(
                  message => message.role === "assistant"
                )
              : null;

          const language =
            lastUser?.active_lang === "hi" ? "Hindi" : "English";

          const userQuery = lastUser
            ? (
                lastUser.transcript ||
                lastUser.text_en ||
                lastUser.text_hi ||
                conversation.title
              )
            : conversation.title || "Conversation";

          const aiResponse = lastAssistant
            ? (
                language === "Hindi"
                  ? lastAssistant.text_hi || lastAssistant.text_en
                  : lastAssistant.text_en || lastAssistant.text_hi
              )
            : "No response recorded yet.";

          return {
            id: conversation.id,
            timestamp: new Date(
              conversation.updated_at || conversation.created_at
            ).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short"
            }),
            userQuery,
            aiResponse,
            isVoiceNote: Boolean(lastUser?.is_voice_note),
            duration: lastUser?.duration_seconds || 0,
            language,
            category: conversation.category || "Civic Assistance",
            messageCount: thread.length,
            updatedAt: conversation.updated_at || conversation.created_at
          };
        });

        if (active) setConversations(formatted);
      } catch (error) {
        console.error("Could not load AI conversations:", error);

        if (active) {
          setLoadError(
            error.message || "Unable to load your conversation history."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadHistory();

    return () => {
      active = false;
    };
  }, []);

  const handleClearHistory = async () => {
    if (!currentUser || clearing) return;

    if (
      !window.confirm(
        "Are you sure you want to permanently clear your Ask AI conversation history?"
      )
    ) {
      return;
    }

    try {
      setClearing(true);
      await deleteOwnConversations(currentUser.id);

      localStorage.removeItem(activeConversationKey(currentUser.id));
      localStorage.removeItem(PENDING_CONVERSATION_KEY);

      setConversations([]);
    } catch (error) {
      console.error("Could not clear AI history:", error);
      window.alert(error.message || "Could not clear conversation history.");
    } finally {
      setClearing(false);
    }
  };

  const openConversation = (conversationId) => {
    localStorage.setItem(PENDING_CONVERSATION_KEY, conversationId);
    localStorage.removeItem(START_NEW_CONVERSATION_KEY);
    go("Ask NagrikAI");
  };

  const startNewConversation = () => {
    localStorage.setItem(START_NEW_CONVERSATION_KEY, "true");
    localStorage.removeItem(PENDING_CONVERSATION_KEY);
    go("Ask NagrikAI");
  };

  const filteredList = conversations.filter(item => {
    if (filter === "voicenote") return item.isVoiceNote;
    if (filter === "text") return !item.isVoiceNote;
    if (filter === "en") return item.language === "English";
    if (filter === "hi") return item.language === "Hindi";
    return true;
  });

  return (
    <div className="page ask-ai-conversations-screen">
      <div className="topbar">
        <button className="icon-btn" onClick={() => go("Ask NagrikAI")}>
          <ChevronLeft size={19} />
        </button>

        <b>Ask AI Conversations</b>

        {conversations.length > 0 && (
          <button
            className="icon-btn"
            onClick={handleClearHistory}
            disabled={clearing}
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
        Review your saved queries, voice transcripts, languages, and NagrikAI responses.
        Your history is linked to your signed-in account.
      </p>

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
          <small>Hindi Chats</small>
        </div>
      </div>

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

      {loading ? (
        <div className="conv-empty-box">
          <MessageSquare size={30} style={{ color: "#38bdf8" }} />
          <h3>Loading your conversations...</h3>
          <p className="muted">Retrieving your saved history securely.</p>
        </div>
      ) : loadError ? (
        <div className="conv-empty-box">
          <MessageSquare size={36} style={{ color: "#ef4444" }} />
          <h3>Unable to load history</h3>
          <p className="muted">{loadError}</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="conv-empty-box">
          <MessageSquare
            size={36}
            style={{ color: "#475569", marginBottom: "12px" }}
          />

          <h3>No conversations found</h3>

          <p className="muted">
            {filter === "all"
              ? "You haven't chatted with NagrikAI yet. Send a text or record a voice note to get started!"
              : "No conversations match the selected filter."}
          </p>

          <button
            className="btn"
            style={{ marginTop: "12px" }}
            onClick={startNewConversation}
          >
            Start a Conversation with AI
          </button>
        </div>
      ) : (
        <div className="conv-cards-list">
          {filteredList.map(conv => (
            <div key={conv.id} className="conv-card">
              <div className="conv-card-top">
                <div className="conv-card-time">
                  <Clock size={11} />
                  <span>{conv.timestamp}</span>
                </div>

                <div className="conv-card-badges">
                  <span
                    className={`conv-type-badge ${conv.isVoiceNote ? "voice" : "text"}`}
                  >
                    {conv.isVoiceNote
                      ? `🎤 Voice Note (${conv.duration || 0}s)`
                      : "💬 Text"}
                  </span>

                  <span
                    className={`conv-lang-badge ${conv.language === "Hindi" ? "hi" : "en"}`}
                  >
                    {conv.language === "Hindi" ? "हिन्दी" : "English"}
                  </span>
                </div>
              </div>

              <div className="conv-query-section">
                <div className="conv-section-label">
                  <span>CITIZEN TRANSCRIPT</span>
                  {conv.category && (
                    <span className="conv-category-tag">{conv.category}</span>
                  )}
                </div>

                <p className="conv-query-text">
                  "{conv.userQuery}"
                </p>
              </div>

              <div className="conv-response-section">
                <div
                  className="conv-section-label"
                  style={{ color: "#28d7a0" }}
                >
                  <Sparkles size={11} style={{ marginRight: "4px" }} />
                  <span>NAGRIKAI RESPONSE</span>
                </div>

                <p className="conv-response-text">
                  {conv.aiResponse}
                </p>
              </div>

              <div className="conv-card-footer">
                <button
                  className="conv-reopen-btn"
                  onClick={() => openConversation(conv.id)}
                >
                  <span>Continue in Ask AI</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "24px", marginBottom: "16px" }}>
        <button className="btn" onClick={startNewConversation}>
          Ask NagrikAI a New Question
        </button>
      </div>
    </div>
  );
}

export default AskAIConversations;