import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  Mic,
  Volume2,
  ChevronLeft,
  Square,
  Navigation,
  Languages,
  Check,
  MessageSquare,
  Plus,
  Play,
  Pause,
  X,
  Trash2,
  Tag,
  HelpCircle
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { getAuthenticatedUser, saveConversationTurn, loadOwnConversation, activeConversationKey, PENDING_CONVERSATION_KEY, START_NEW_CONVERSATION_KEY } from "./aiConversationStore";
import { SERVICE_KNOWLEDGE, generateOfflineCivicResponse } from "./localCivicAi";
import "./askAI.css";

// Fast, reliable, zero-dependency offline local civic response engine
async function generateAIModelResponse(query, liveReports = [], isVoiceNote = false, duration = 0, chatHistory = [], currentLang = "English") {
  // Simulate a smooth, natural conversational thinking pause (350ms) to retain the interactive UI feedback
  await new Promise((resolve) => setTimeout(resolve, 350));

  return generateOfflineCivicResponse(query, liveReports, isVoiceNote, duration, chatHistory, currentLang);
}

// Interactive Voice Note Player Component
function VoiceNotePlayer({ audioUrl, duration = 0, transcript = "", lang = "en" }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.warn("Audio playback error:", err);
          setIsPlaying(false);
        });
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setTotalDuration(audioRef.current.duration);
      }
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const progressPct = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0;

  return (
    <div className="voicenote-card">
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onLoadedMetadata={(e) => {
          if (e.target.duration && !isNaN(e.target.duration)) {
            setTotalDuration(e.target.duration);
          }
        }}
      />

      <div className="voicenote-player-row">
        <button
          type="button"
          className={`voicenote-play-btn ${isPlaying ? "playing" : ""}`}
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause voice note" : "Play voice note"}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: "2px" }} />}
        </button>

        <div
          className="voicenote-waveform-container"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const newPct = clickX / rect.width;
            if (audioRef.current && totalDuration > 0) {
              audioRef.current.currentTime = newPct * totalDuration;
            }
          }}
          title="Click to seek"
        >
          <div className={`voicenote-waveform-bars ${isPlaying ? "animating" : ""}`}>
            {[35, 65, 90, 45, 80, 100, 50, 75, 95, 40, 85, 60, 90, 55, 70, 40, 65, 85, 50, 70].map((h, i) => (
              <span
                key={i}
                style={{
                  height: `${h}%`,
                  opacity: (i / 20) * 100 <= progressPct ? 1 : 0.4
                }}
              />
            ))}
          </div>
          <div className="voicenote-progress-track">
            <div className="voicenote-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <span className="voicenote-time-badge">
          {isPlaying ? formatTime(currentTime) : formatTime(totalDuration)}
        </span>
      </div>

      {transcript && (
        <div className="voicenote-transcript-preview">
          <span className="voicenote-transcript-label">
            {lang === "hi" ? "ट्रांसक्रिप्ट" : "TRANSCRIPT"}
          </span>
          <p className="voicenote-transcript-text">"{transcript}"</p>
        </div>
      )}
    </div>
  );
}

export function AskAI({
  go,
  onClose,
  query = "",
  setQuery,
  language = "English",
  setLanguage = () => {}
}) {
  const [currentLang, setCurrentLang] = useState(language || "English");
  const [outputMode, setOutputMode] = useState("both"); // "both" (Voice + Text) or "text" (Text Only)
  const [messages, setMessages] = useState([
    {
      id: "m-welcome",
      role: "assistant",
      textEn: "Hello Citizen! I'm NagrikAI — your city AI assistant. You can speak or type to ask about road hazards, municipal services, complaint statuses, or GNIDA departments.",
      textHi: "नमस्ते नागरिक! मैं नागरिक एआई हूँ — आपका शहर एआई सहायक। आप ग्रेटर नोएडा की सड़कों के गड्ढे, नागरिक सेवाएं, शिकायत स्थिति या जीएनआईडीए विभागों के बारे में बोलकर या लिखकर पूछ सकते हैं।",
      activeLang: language === "Hindi" ? "hi" : "en",
      actions: [
        { labelEn: "What do you provide?", labelHi: "आप क्या सेवाएं देते हैं?", query: "What civic services does NagrikAI provide?" },
        { labelEn: "Potholes in Alpha II", labelHi: "अल्फा II में गड्ढे", query: "What potholes are reported in Alpha II?" },
        { labelEn: "Pari Chowk traffic", labelHi: "परी चौक ट्रैफिक", query: "How is the traffic and road condition near Pari Chowk?" }
      ]
    }
  ]);

  const [inputVal, setInputVal] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [dbReports, setDbReports] = useState([]);

  // Voice Note Recording State
  const [isRecordingVoiceNote, setIsRecordingVoiceNote] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Authenticated, per-user conversation state
  const authUserRef = useRef(null);
  const conversationIdRef = useRef(null);
  const conversationInitPromiseRef = useRef(Promise.resolve());
  const conversationSaveQueueRef = useRef(Promise.resolve());

  const startNewConversation = async () => {
    await conversationSaveQueueRef.current;

    const user = authUserRef.current || await getAuthenticatedUser();
    authUserRef.current = user;

    conversationIdRef.current = null;
    localStorage.removeItem(activeConversationKey(user.id));
    localStorage.removeItem(PENDING_CONVERSATION_KEY);
    localStorage.removeItem(START_NEW_CONVERSATION_KEY);

    setMessages(current =>
      current.filter(message => message.id === "m-welcome")
    );
    setInputVal("");
  };
  const persistConversationTurn = (userMessage, assistantMessage) => {
    const saveTurn = async () => {
      await conversationInitPromiseRef.current;

      const user = authUserRef.current || await getAuthenticatedUser();
      authUserRef.current = user;

      const storageKey = activeConversationKey(user.id);
      let conversationId = conversationIdRef.current;

      if (!conversationId) {
        const storedId = localStorage.getItem(storageKey);

        if (storedId) {
          const existing = await loadOwnConversation(storedId, user.id);
          if (existing) conversationId = storedId;
        }
      }

      const savedId = await saveConversationTurn({
        conversationId,
        user,
        userMessage,
        assistantMessage
      });

      conversationIdRef.current = savedId;
      localStorage.setItem(storageKey, savedId);
    };

    conversationSaveQueueRef.current =
      conversationSaveQueueRef.current
        .then(saveTurn)
        .catch(error => {
          console.error("Could not save AI conversation to Supabase:", error);
        });

    return conversationSaveQueueRef.current;
  };

  // Refs to eliminate stale closure bugs during speech recognition
  const latestTranscriptRef = useRef("");
  const isRecordingRef = useRef(false);

  // Sync external language changes
  useEffect(() => {
    if (language && language !== currentLang) {
      setCurrentLang(language);
    }
  }, [language]);

  const handleLangChange = (newLang) => {
    setCurrentLang(newLang);
    setLanguage(newLang);
    stopSpeaking();
  };

  // Fetch live reports from Supabase on mount
  useEffect(() => {
    let active = true;
    async function loadReports() {
      if (!isSupabaseConfigured) return;
      try {
        const { data } = await supabase
          .from("reports")
          .select("id, report_number, title, category, status, groundtruth_status, community_status, locality, latitude, longitude, created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (active && Array.isArray(data)) {
          setDbReports(data);
        }
      } catch (err) {
        console.warn("AskAI reports fetch:", err);
      }
    }
    loadReports();

    if (!isSupabaseConfigured) return;
    const channel = supabase
      .channel("ask-ai-live-reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, loadReports)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    return () => { active = false; };
  }, []);

  // Initialise only the signed-in user's conversation thread.
  useEffect(() => {
    let active = true;

    const initializeConversation = async () => {
      const pendingId = localStorage.getItem(PENDING_CONVERSATION_KEY);
      if (pendingId) {
        localStorage.removeItem(PENDING_CONVERSATION_KEY);
      }

      const startNew =
        localStorage.getItem(START_NEW_CONVERSATION_KEY) === "true";

      if (startNew) {
        localStorage.removeItem(START_NEW_CONVERSATION_KEY);
      }

      const user = await getAuthenticatedUser();
      if (!active) return;

      authUserRef.current = user;

      const storageKey = activeConversationKey(user.id);

      if (startNew) {
        conversationIdRef.current = null;
        localStorage.removeItem(storageKey);
        return;
      }

      const targetId = pendingId || localStorage.getItem(storageKey);
      if (!targetId) return;

      const restored = await loadOwnConversation(targetId, user.id);
      if (!active) return;

      if (!restored) {
        conversationIdRef.current = null;
        localStorage.removeItem(storageKey);
        console.warn("Requested AI conversation was not found for this account.");
        return;
      }

      conversationIdRef.current = targetId;
      localStorage.setItem(storageKey, targetId);

      setMessages(current => {
        const welcome = current.find(message => message.id === "m-welcome");
        return [...(welcome ? [welcome] : []), ...restored.messages];
      });

      const lastUserMessage = [...restored.messages]
        .reverse()
        .find(message => message.role === "user");

      if (lastUserMessage) {
        const restoredLanguage =
          lastUserMessage.activeLang === "hi" ? "Hindi" : "English";

        setCurrentLang(restoredLanguage);
        setLanguage(restoredLanguage);
      }
    };

    const initialization = initializeConversation();
    conversationInitPromiseRef.current = initialization;

    initialization.catch(error => {
      console.error("AI conversation initialization failed:", error);
    });

    return () => {
      active = false;
    };
  }, []);
  // Check for pending reopened conversation or query from outside
  useEffect(() => {
    const reopened = localStorage.getItem("nagrikai_pending_reopen_query");
    if (reopened) {
      localStorage.removeItem("nagrikai_pending_reopen_query");
      handleSend(reopened);
      return;
    }

    if (window.__pendingVoiceNote) {
      const p = window.__pendingVoiceNote;
      window.__pendingVoiceNote = null;
      handleSendVoiceNote(p.audioUrl, p.duration, p.transcript, p.lang || (currentLang === "Hindi" ? "hi" : "en"));
    } else if (query && query.trim()) {
      handleSend(query.trim());
      if (setQuery) setQuery("");
    }
  }, [query]);

  // Scroll to bottom on new message or recording state change
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isRecordingVoiceNote, liveTranscript]);

  // Clean up any audio streams on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      isRecordingRef.current = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  // Robust SpeechSynthesis with native Hindi voice selection
  const speakText = (text, targetLang = currentLang) => {
    if (outputMode === "text" || !window.speechSynthesis) return;

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const isHi = targetLang === "Hindi" || targetLang === "hi" || /[\u0900-\u097F]/.test(text);

      utter.lang = isHi ? "hi-IN" : "en-IN";
      utter.rate = isHi ? 0.95 : 1.0;
      utter.pitch = 1.0;

      // Select matching voice
      const voices = window.speechSynthesis.getVoices();
      if (isHi) {
        const hiVoice = voices.find(v => v.lang.startsWith("hi") || v.name.toLowerCase().includes("hindi"));
        if (hiVoice) utter.voice = hiVoice;
      } else {
        const enVoice = voices.find(v => v.lang === "en-IN" || v.lang.startsWith("en"));
        if (enVoice) utter.voice = enVoice;
      }

      utter.onstart = () => setIsSpeaking(true);
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Start Voice Note Recording
  const startVoiceNoteRecording = async () => {
    stopSpeaking();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone recording is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let mimeType = "";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
          mimeType = "audio/ogg";
        }
      }

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);

      latestTranscriptRef.current = "";
      isRecordingRef.current = true;
      setLiveTranscript("");

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recog = new SpeechRecognition();
          recog.continuous = true;
          recog.interimResults = true;
          recog.lang = currentLang === "Hindi" ? "hi-IN" : "en-IN";

          recog.onresult = (event) => {
            let fullText = "";
            for (let i = 0; i < event.results.length; ++i) {
              fullText += event.results[i][0].transcript + " ";
            }
            const cleanText = fullText.trim();
            if (cleanText) {
              latestTranscriptRef.current = cleanText;
              setLiveTranscript(cleanText);
            }
          };

          recog.onerror = (e) => {
            if (e.error !== "no-speech") {
              console.warn("Speech recognition notice:", e.error);
            }
          };

          recog.onend = () => {
            if (isRecordingRef.current) {
              try { recog.start(); } catch {}
            }
          };

          recog.start();
          recognitionRef.current = recog;
        } catch (recErr) {
          console.warn("Speech recognition initialization:", recErr);
        }
      }

      setRecordingSeconds(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

      setIsRecordingVoiceNote(true);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Could not access microphone. Please enable microphone permission in your browser.");
    }
  };

  // Stop Recording and Send Voice Note
  const stopVoiceNoteAndSend = () => {
    if (!mediaRecorderRef.current || !isRecordingVoiceNote) return;

    isRecordingRef.current = false;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const duration = recordingSeconds || 1;
    const transcriptText = (latestTranscriptRef.current || liveTranscript || "").trim();

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    mediaRecorderRef.current.onstop = () => {
      try {
        const mime = mediaRecorderRef.current?.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        const audioUrl = URL.createObjectURL(audioBlob);

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(t => t.stop());
          mediaStreamRef.current = null;
        }

        handleSendVoiceNote(audioUrl, duration, transcriptText, currentLang === "Hindi" ? "hi" : "en");
      } catch (err) {
        console.error("Voice note assembly error:", err);
      }
    };

    try {
      mediaRecorderRef.current.stop();
    } catch (e) {
      console.warn("MediaRecorder stop error:", e);
    }

    setIsRecordingVoiceNote(false);
    setLiveTranscript("");
  };

  // Cancel Voice Note Recording without sending
  const cancelVoiceNote = () => {
    isRecordingRef.current = false;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch {}
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    audioChunksRef.current = [];
    latestTranscriptRef.current = "";
    setIsRecordingVoiceNote(false);
    setLiveTranscript("");
    setRecordingSeconds(0);
  };

  // Send Voice Note Message & Generate Conversational AI Response
  const handleSendVoiceNote = async (audioUrl, duration, transcriptText, lang = "en") => {
    const isHi = lang === "hi" || currentLang === "Hindi";
    const queryText = (transcriptText || "").trim() || (isHi ? "वॉयसनोट द्वारा प्रश्न" : "Voice note civic query");

    stopSpeaking();
    const userMsg = {
      id: "u-vn-" + Date.now(),
      role: "user",
      isVoiceNote: true,
      audioUrl: audioUrl,
      duration: duration,
      transcript: transcriptText,
      textEn: transcriptText ? `🎤 Voice Note: "${transcriptText}"` : "🎤 Voice Note",
      textHi: transcriptText ? `🎤 वॉयसनोट: "${transcriptText}"` : "🎤 वॉयसनोट",
      activeLang: isHi ? "hi" : "en",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const aiResponse = await generateAIModelResponse(queryText, dbReports, true, duration, messages, currentLang);

      const assistantMsg = {
        id: "a-vn-" + Date.now(),
        role: "assistant",
        textEn: aiResponse.en,
        textHi: aiResponse.hi,
        activeLang: isHi ? "hi" : "en",
        actions: aiResponse.actions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages(prev => [...prev, assistantMsg]);
      persistConversationTurn(userMsg, assistantMsg);
      setInputVal("");
      setLiveTranscript("");
      latestTranscriptRef.current = "";
      if (setQuery) setQuery("");

      // Speak AI response if voice mode is enabled
      const textToSpeak = isHi ? aiResponse.hi : aiResponse.en;
      speakText(textToSpeak, isHi ? "Hindi" : "English");
    } catch (err) {
      console.warn("AI voice response error:", err);
    } finally {
      setIsThinking(false);
    }
  };

  // Send Text Message
  const handleSend = async (textToSend = null) => {
    const q = (textToSend !== null ? textToSend : inputVal).trim();
    if (!q || isThinking) return;

    stopSpeaking();
    if (isRecordingVoiceNote) cancelVoiceNote();

    const isHi = currentLang === "Hindi" || /[\u0900-\u097F]/.test(q);

    const userMsg = {
      id: "u-" + Date.now(),
      role: "user",
      textEn: q,
      textHi: q,
      activeLang: isHi ? "hi" : "en",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal("");
    setLiveTranscript("");
    latestTranscriptRef.current = "";
    if (setQuery) setQuery("");
    setIsThinking(true);

    try {
      const aiResponse = await generateAIModelResponse(q, dbReports, false, 0, messages, currentLang);

      const assistantMsg = {
        id: "a-" + Date.now(),
        role: "assistant",
        textEn: aiResponse.en,
        textHi: aiResponse.hi,
        activeLang: isHi ? "hi" : "en",
        actions: aiResponse.actions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages(prev => [...prev, assistantMsg]);
      persistConversationTurn(userMsg, assistantMsg);

      // Speak AI response if voice mode is enabled
      const textToSpeak = isHi ? aiResponse.hi : aiResponse.en;
      speakText(textToSpeak, isHi ? "Hindi" : "English");
    } catch (err) {
      console.warn("AI text response error:", err);
    } finally {
      setIsThinking(false);
    }
  };

  // Toggle message language display between English and Hindi
  const toggleMessageLang = (msgId) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id === msgId) {
          const nextLang = m.activeLang === "hi" ? "en" : "hi";
          return { ...m, activeLang: nextLang };
        }
        return m;
      })
    );
  };

  const formatSeconds = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const suggestionChips = [
    { labelEn: "🌟 What services do you provide?", labelHi: "🌟 आपकी सेवाएं क्या हैं?", q: "What civic services does NagrikAI provide?" },
    { labelEn: "🚗 Potholes in Alpha II", labelHi: "🚗 अल्फा II में गड्ढे", q: "What potholes are reported in Alpha II?" },
    { labelEn: "🚦 Pari Chowk traffic & route", labelHi: "🚦 परी चौक ट्रैफिक", q: "How is the traffic and road condition near Pari Chowk?" },
    { labelEn: "📸 How GroundTruth AI works?", labelHi: "📸 ग्राउंडट्रूथ एआई कैसे काम करता है?", q: "How does GroundTruth AI verify repairs?" },
    { labelEn: "📋 Check complaint status", labelHi: "📋 मेरी शिकायतों की स्थिति", q: "What is the status of my reported complaints?" },
    { labelEn: "📞 GNIDA Authority Helplines", labelHi: "📞 जीएनआईडीए हेल्पलाइन नंबर", q: "What are the contact numbers for GNIDA and NPCL?" }
  ];

  return (
    <div className="page ask-ai-container">
      {/* Top Bar */}
      <div className="topbar">
        <button
          className="icon-btn"
          onClick={() => onClose ? onClose() : go("Home")}
          aria-label={onClose ? "Close Ask AI" : "Back to home"}
        >
          {onClose ? <X size={18} /> : <ChevronLeft size={19} />}
        </button>
        <b>{currentLang === "Hindi" ? "नागरिक एआई" : "Ask NagrikAI"}</b>
        <button
          className="icon-btn"
          onClick={() => go("Voice assistant")}
          title="Open Fullscreen Voice Assistant"
          style={{ color: "#28d7a0" }}
        >
            <Mic size={18} />
        </button>
        <button
          className="icon-btn"
          onClick={() => go("AI conversations")}
          title="View AI conversation history"
        >
            <MessageSquare size={18} />
        </button>
        <button
          className="icon-btn"
          onClick={() => startNewConversation().catch(error => console.error("Could not start new conversation:", error))}
          title="Start a new conversation"
        >
          <Plus size={17} />
        </button>
      </div>

      {/* Control Header: Language Options & Output Mode */}
      <div className="ask-ai-header">
        <div className="ask-ai-header-row">
          <span className="ask-ai-badge">
            <Sparkles size={11} />
            {currentLang === "Hindi" ? "नागरिक बुद्धिमत्ता मॉडल" : "CIVIC AI MODEL"}
          </span>

          {/* Language Selector Toggle */}
          <div className="lang-selector-group">
            <button
              className={`lang-selector-btn ${currentLang === "English" ? "active" : ""}`}
              onClick={() => handleLangChange("English")}
            >
              English
            </button>
            <button
              className={`lang-selector-btn ${currentLang === "Hindi" ? "active" : ""}`}
              onClick={() => handleLangChange("Hindi")}
            >
              हिन्दी
            </button>
          </div>
        </div>

        {/* Output Mode Switcher: Voice & Text vs Text Only */}
        <div className="ask-ai-controls-row">
          <span style={{ fontSize: "10px", color: "#64748b", fontWeight: "600" }}>
            {currentLang === "Hindi" ? "आउटपुट विकल्प:" : "OUTPUT MODE:"}
          </span>

          <div className="output-mode-group">
            <button
              className={`output-mode-btn ${outputMode === "both" ? "active" : ""}`}
              onClick={() => setOutputMode("both")}
              title="AI outputs both text and voice speech"
            >
              <Volume2 size={12} />
              <span>{currentLang === "Hindi" ? "आवाज + टेक्स्ट" : "Voice & Text"}</span>
            </button>

            <button
              className={`output-mode-btn ${outputMode === "text" ? "active" : ""}`}
              onClick={() => {
                stopSpeaking();
                setOutputMode("text");
              }}
              title="AI outputs text only (Muted)"
            >
              <MessageSquare size={12} />
              <span>{currentLang === "Hindi" ? "केवल टेक्स्ट" : "Text Only"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Speech Synthesizer Waves Banner */}
      {isSpeaking && (
        <div className="speaking-banner">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="speaking-waves">
              <span className="speaking-wave-bar" />
              <span className="speaking-wave-bar" />
              <span className="speaking-wave-bar" />
              <span className="speaking-wave-bar" />
            </div>
            <span>
              {currentLang === "Hindi" ? "नागरिक एआई बोल रहा है (हिन्दी)..." : "NagrikAI speaking (English)..."}
            </span>
          </div>
          <button className="speaking-stop-btn" onClick={stopSpeaking}>
            <Square size={10} style={{ marginRight: "3px" }} />
            {currentLang === "Hindi" ? "रोकें" : "Stop"}
          </button>
        </div>
      )}

      {/* Live Voice Note Recording Bar */}
      {isRecordingVoiceNote && (
        <div className="live-voicenote-recording-bar">
          <div className="live-rec-left">
            <div className="live-rec-dot-pulse" />
            <span className="live-rec-timer">
              REC {formatSeconds(recordingSeconds)}
            </span>
            <div className="live-rec-waveform">
              <span /><span /><span /><span /><span /><span /><span /><span />
            </div>
          </div>

          <div className="live-rec-right">
            <button
              type="button"
              className="live-rec-cancel-btn"
              onClick={cancelVoiceNote}
              title={currentLang === "Hindi" ? "वॉयसनोट रद्द करें" : "Cancel Voice Note"}
            >
              <Trash2 size={15} />
            </button>

            <button
              type="button"
              className="live-rec-send-btn"
              onClick={stopVoiceNoteAndSend}
              title={currentLang === "Hindi" ? "वॉयसनोट भेजें" : "Send Voice Note"}
            >
              <Check size={16} />
              <span>{currentLang === "Hindi" ? "भेजें" : "Send"}</span>
            </button>
          </div>

          <div className="live-rec-transcript-bubble">
            <small>{currentLang === "Hindi" ? "लाइव शब्द / ट्रांसक्रिप्ट:" : "Live speech preview:"}</small>
            <p>
              {liveTranscript || (
                <span style={{ color: "#64748b", fontStyle: "italic" }}>
                  {currentLang === "Hindi" ? "बोलिए, आपकी आवाज रिकॉर्ड हो रही है..." : "Speak now, your audio is recording live..."}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Chat Messages Stream */}
      <div className="chat-stream">
        {messages.map((m) => {
          const displayText = m.activeLang === "hi" ? (m.textHi || m.textEn) : (m.textEn || m.textHi);

          return (
            <div key={m.id} className={`msg-row ${m.role}`}>
              <div className="msg-bubble">
                {/* Voice Note Player Card if message contains audio */}
                {m.audioUrl ? (
                  <VoiceNotePlayer
                    audioUrl={m.audioUrl}
                    duration={m.duration}
                    transcript={m.transcript}
                    lang={m.activeLang}
                  />
                ) : (
                  <p style={{ margin: 0, fontSize: "12px", lineHeight: "1.58", whiteSpace: "pre-line" }}>
                    {displayText}
                  </p>
                )}

                {/* In-app Navigation / Conversational Chips */}
                {m.actions && m.actions.length > 0 && (
                  <div className="msg-actions">
                    {m.actions.map((act, i) => (
                      <button
                        key={i}
                        className="msg-action-chip"
                        onClick={() => {
                          if (act.screen) go(act.screen);
                          else if (act.query) handleSend(act.query);
                        }}
                      >
                        <Navigation size={10} />
                        {m.activeLang === "hi" ? act.labelHi : act.labelEn}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="msg-meta-row">
                {m.timestamp && <span>{m.timestamp}</span>}

                {m.role === "assistant" && (
                  <>
                    {/* Speak Button (in message's active language) */}
                    <button
                      className="msg-listen-btn"
                      onClick={() => speakText(displayText, m.activeLang === "hi" ? "Hindi" : "English")}
                      title={m.activeLang === "hi" ? "हिन्दी में सुनें" : "Listen in English"}
                    >
                      <Volume2 size={12} />
                      <span>{m.activeLang === "hi" ? "सुनें (हिन्दी)" : "Listen"}</span>
                    </button>

                    {/* Toggle Language between Hindi and English */}
                    <button
                      className="msg-translate-btn"
                      onClick={() => toggleMessageLang(m.id)}
                      title="Translate between English and Hindi"
                    >
                      <Languages size={12} />
                      <span>{m.activeLang === "hi" ? "English" : "हिन्दी"}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {isThinking && (
          <div className="msg-row assistant thinking">
            <div className="avatar assistant-avatar"><Sparkles size={14} /></div>
            <div className="msg-bubble">
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Suggested Prompts based on real database topics */}
      <div className="prompt-suggestions">
        <div className="prompt-suggestions-label">
          {currentLang === "Hindi" ? "सुझाए गए नागरिक प्रश्न" : "POPULAR CIVIC QUESTIONS"}
        </div>
        <div className="prompt-chips-scroll">
          {suggestionChips.map((chip, idx) => (
            <button
              key={idx}
              className="prompt-chip"
              onClick={() => handleSend(chip.q)}
            >
              {currentLang === "Hindi" ? chip.labelHi : chip.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar with Mic & Send */}
      <div className="ai-input-bar">
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          disabled={isRecordingVoiceNote || isThinking}
          placeholder={
            isRecordingVoiceNote
              ? (currentLang === "Hindi" ? "वॉयसनोट रिकॉर्ड हो रहा है..." : "Recording voice note...")
              : isThinking
              ? (currentLang === "Hindi" ? "नागरिक एआई सोच रहा है..." : "NagrikAI is thinking...")
              : (currentLang === "Hindi" ? "सड़क, ट्रैफिक, या शिकायत के बारे में पूछें..." : "Ask anything about roads, traffic, or complaints...")
          }
        />

        {/* Live Voice Note Microphone Button */}
        <button
          className={`ai-mic-btn ${isRecordingVoiceNote ? "listening" : ""}`}
          onClick={isRecordingVoiceNote ? stopVoiceNoteAndSend : startVoiceNoteRecording}
          disabled={isThinking}
          title={isRecordingVoiceNote ? "Stop & Send Voice Note" : (currentLang === "Hindi" ? "वॉयसनोट रिकॉर्ड करने के लिए दबाएं" : "Record Voice Note")}
          aria-label="Voice note input"
        >
          {isRecordingVoiceNote ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}
        </button>

        {/* Send Button */}
        <button
          className="ai-send-btn"
          onClick={() => handleSend()}
          disabled={!inputVal.trim() || isRecordingVoiceNote || isThinking}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>

      <p className="hint" style={{ marginTop: "8px", textAlign: "center" }}>
        {currentLang === "Hindi"
          ? "नागरिक एआई ग्रेटर नोएडा नगर पालिका सेवाओं और जीएनआईडीए नागरिक रिकॉर्ड से जुड़ा है।"
          : "Powered by Greater Noida civic intelligence & verified municipal records."}
      </p>
    </div>
  );
}

export function Voice({
  recording,
  setRecording,
  go,
  query,
  setQuery,
  language = "English",
  setLanguage = () => {}
}) {
  const [currentLang, setCurrentLang] = useState(language || "English");
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const latestTranscriptRef = useRef("");
  const isRecordingRef = useRef(false);

  useEffect(() => {
    if (language && language !== currentLang) {
      setCurrentLang(language);
    }
  }, [language]);

  const handleLangToggle = (newLang) => {
    if (isRecording) {
      stopVoiceRecording(false);
    }
    setCurrentLang(newLang);
    setLanguage(newLang);
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Microphone not supported on this device/browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let mimeType = "";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }
      }

      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);

      latestTranscriptRef.current = "";
      isRecordingRef.current = true;
      setTranscript("");

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recog = new SpeechRecognition();
          recog.continuous = true;
          recog.interimResults = true;
          recog.lang = currentLang === "Hindi" ? "hi-IN" : "en-IN";

          recog.onresult = (event) => {
            let fullText = "";
            for (let i = 0; i < event.results.length; ++i) {
              fullText += event.results[i][0].transcript + " ";
            }
            const clean = fullText.trim();
            if (clean) {
              latestTranscriptRef.current = clean;
              setTranscript(clean);
            }
          };

          recog.onerror = (e) => {
            if (e.error !== "no-speech") {
              console.warn("Voice assistant speech notice:", e.error);
            }
          };

          recog.onend = () => {
            if (isRecordingRef.current) {
              try { recog.start(); } catch {}
            }
          };

          recog.start();
          recognitionRef.current = recog;
        } catch (e) {
          console.warn("Speech recognition error:", e);
        }
      }

      setSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);

      setIsRecording(true);
      if (setRecording) setRecording(true);
    } catch (err) {
      console.error("Microphone permission failed:", err);
      alert("Could not access microphone. Please enable microphone permissions.");
    }
  };

  const stopVoiceRecording = (shouldNavigate = true) => {
    isRecordingRef.current = false;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    const duration = seconds || 1;
    const spoken = (latestTranscriptRef.current || transcript || "").trim();

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        try {
          const mime = mediaRecorderRef.current?.mimeType || "audio/webm";
          const audioBlob = new Blob(audioChunksRef.current, { type: mime });
          const audioUrl = URL.createObjectURL(audioBlob);

          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop());
            mediaStreamRef.current = null;
          }

          if (shouldNavigate) {
            window.__pendingVoiceNote = {
              audioUrl,
              duration,
              transcript: spoken,
              lang: currentLang === "Hindi" ? "hi" : "en"
            };
            go("Ask NagrikAI");
          }
        } catch (e) {
          console.error("Voice note stop error:", e);
        }
      };

      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn("Recorder stop error:", e);
      }
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
    }

    setIsRecording(false);
    if (setRecording) setRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopVoiceRecording(true);
    } else {
      startVoiceRecording();
    }
  };

  const formatSecs = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? "0" : ""}${sec}`;
  };

  return (
    <div className="page voice-mode-screen">
      {/* Top Bar with Language Selector */}
      <div className="topbar">
        <button className="icon-btn" onClick={() => {
          if (isRecording) stopVoiceRecording(false);
          go("Ask NagrikAI");
        }}>
          <ChevronLeft size={19} />
        </button>
        <b>{currentLang === "Hindi" ? "बोलकर पूछें" : "Speak your city"}</b>

        <div className="lang-selector-group" style={{ transform: "scale(0.9)" }}>
          <button
            className={`lang-selector-btn ${currentLang === "English" ? "active" : ""}`}
            onClick={() => handleLangToggle("English")}
          >
            EN
          </button>
          <button
            className={`lang-selector-btn ${currentLang === "Hindi" ? "active" : ""}`}
            onClick={() => handleLangToggle("Hindi")}
          >
            हिन्दी
          </button>
        </div>
      </div>

      <div className="eyebrow">
        {currentLang === "Hindi" ? "आवाज मोड • हिन्दी / ENGLISH" : "VOICE MODE • ENGLISH / हिन्दी"}
      </div>

      <h1 style={{ whiteSpace: "pre-line" }}>
        {isRecording
          ? (currentLang === "Hindi" ? `सुन रहा हूँ...\n[REC ${formatSecs(seconds)}]` : `I'm listening.\n[REC ${formatSecs(seconds)}]`)
          : (currentLang === "Hindi" ? "बोलने के लिए\nटैप करें।" : "Tap the orb.\nSpeak your city.")}
      </h1>

      {/* Interactive Animated Voice Orb */}
      <button
        className={`voice-orb-interactive ${isRecording ? "listening" : ""}`}
        onClick={toggleRecording}
        title={isRecording ? "Tap to finish and ask AI" : "Tap to record voice note"}
      >
        <span /><span /><span /><span /><span /><span />
        <span /><span /><span /><span /><span />
      </button>

      <p className={`center ${isRecording ? "green" : "muted"}`} style={{ fontWeight: 600 }}>
        {isRecording
          ? (currentLang === "Hindi" ? "● वॉयसनोट रिकॉर्ड हो रहा है — भेजने के लिए दोबारा टैप करें" : "● Recording voice note — tap orb to send to AI")
          : (currentLang === "Hindi" ? `● भाषा: हिन्दी — शुरू करने के लिए ऊपर टैप करें` : `● Language: English — tap orb above to record`)}
      </p>

      {/* Live Transcript Box */}
      <div className="voice-transcript-box">
        <div className="voice-transcript-label">
          <span>{currentLang === "Hindi" ? "लाइव ट्रांसक्रिप्ट" : "LIVE TRANSCRIPT"}</span>
          <span style={{ color: "#94a3b8", fontWeight: "normal" }}>
            {currentLang === "Hindi" ? "हिन्दी इनपुट" : "English input"}
          </span>
        </div>
        <div className="voice-transcript-text">
          {transcript || (
            <span style={{ color: "#64748b", fontStyle: "italic" }}>
              {currentLang === "Hindi"
                ? "यहाँ आपके बोले गए शब्द वास्तविक समय में दिखाई देंगे..."
                : "Your speech will appear here in real-time as you speak..."}
            </span>
          )}
        </div>
      </div>

      <button
        className="btn"
        onClick={() => stopVoiceRecording(true)}
        disabled={!isRecording && !transcript.trim()}
      >
        {currentLang === "Hindi" ? "यह वॉयसनोट एआई से पूछें" : "Send this voice note to AI"}
      </button>

      <button
        className="btn secondary"
        onClick={() => {
          if (isRecording) stopVoiceRecording(false);
          go("Ask NagrikAI");
        }}
      >
        {currentLang === "Hindi" ? "चैट पर वापस जाएं" : "Back to Ask AI Chat"}
      </button>

      <p className="hint">
        {currentLang === "Hindi"
          ? "नेगेटिव लेटेंसी मीडिया रिकॉर्डर एवं वेब स्पीच द्वारा संचालित। हिन्दी और अंग्रेजी में पूर्ण दोतरफा वॉयसनोट समर्थित।"
          : "Powered by native MediaRecorder & Web Speech. Complete two-way voicenotes in English & Hindi."}
      </p>
    </div>
  );
}

export default AskAI;
