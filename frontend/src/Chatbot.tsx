import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import {
  FiSend,
  FiPaperclip,
  FiMic,
  FiMicOff,
  FiTrash2,
  FiDownload,
  FiSettings,
  FiMessageSquare,
  FiClock,
  FiPlus,
  FiMenu, 
  FiX,
  FiHome,
  FiMoon,
  FiSun,
  FiType,
  FiVolume2,
  FiVolumeX,
  FiZap,
  FiArrowDown,
  FiAlertTriangle} from "react-icons/fi";
import "./index.css";

/* ── Types ───────────────────────────────────────── */
type LinkItem = { label: string; url: string };

type Message = {
  role: "bot" | "user";
  text: string;
  time: string;
  quickTags?: string[];
  pdfUrl?: string;
  links?: LinkItem[];
};

type ChatSession = {
  id: string;        // unique session id (timestamp)
  title: string;     // first user message, truncated
  date: string;      // ISO date string of last update
  messages: Message[];
};

type Settings = {
  darkMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
  bubbleStyle: 'modern' | 'classic' | 'minimal';
  sendOnEnter: boolean;
  soundEffects: boolean;
  messageAnimations: boolean;
  autoScroll: boolean;
};

/* ── Storage Helpers ─────────────────────────────── */
const STORAGE_KEY  = "pu_chat_sessions";
const MAX_SESSIONS = 20;

const loadSessions = (): ChatSession[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const persistSessions = (sessions: ChatSession[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
};

/* ── Settings Helpers ───────────────────────────── */
const SETTINGS_KEY = "pu_settings";
const DEFAULT_SETTINGS: Settings = {
  darkMode: false,
  fontSize: 'medium',
  bubbleStyle: 'modern',
  sendOnEnter: true,
  soundEffects: true,
  messageAnimations: true,
  autoScroll: true,
};

const loadSettings = (): Settings => {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const persistSettings = (s: Settings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
};

/* ── Date Helper ─────────────────────────────────── */
const relativeDate = (iso: string): string => {
  const d     = new Date(iso);
  const today = new Date();
  const diff  = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

/* ── Utilities ───────────────────────────────────── */
const BACKEND_URL = "http://127.0.0.1:5000/api/chat";

const getUserInitials = (name: string | null): string => {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[1][0]).toUpperCase();
};

/* ════════════════════════════════════════════════════
   MAIN CHATBOT COMPONENT
   ════════════════════════════════════════════════════ */
const App = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [input, setInput] = useState("");
  const [firstScreen, setFirstScreen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const chatBodyRef = useRef<HTMLDivElement>(null);
  const currentSessionId = useRef<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const profile = {
    full_name:  localStorage.getItem("user_name"),
    department: localStorage.getItem("user_department"),
    batch:      localStorage.getItem("user_batch"),
    email:      localStorage.getItem("user_email"),
  };
  const isGuest = !profile.full_name;

  /* Auto-scroll on new messages */
  useEffect(() => {
    if (settings.autoScroll) {
      chatBodyRef.current?.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isTyping, settings.autoScroll]);

  /* Apply settings to DOM */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark-mode', settings.darkMode);
    root.classList.remove('font-small', 'font-medium', 'font-large');
    root.classList.add(`font-${settings.fontSize}`);
    root.classList.remove('bubble-modern', 'bubble-classic', 'bubble-minimal');
    root.classList.add(`bubble-${settings.bubbleStyle}`);
    root.classList.toggle('no-animations', !settings.messageAnimations);
  }, [settings]);

  /* Cleanup speech recognition on unmount */
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  /* Settings update helper */
  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      persistSettings(next);
      return next;
    });
  };

  /* ── Voice Input (Web Speech API) ────────────── */
  const [voiceToast, setVoiceToast] = useState<string | null>(null);
  const [voiceLang, setVoiceLang] = useState<"en" | "hi">("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const voiceToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showVoiceToast = useCallback((msg: string) => {
    setVoiceToast(msg);
    if (voiceToastTimer.current) clearTimeout(voiceToastTimer.current);
    voiceToastTimer.current = setTimeout(() => setVoiceToast(null), 4000);
  }, []);

  /* Translate Hindi text to English using MyMemory API (free, no key needed) */
  const translateToEnglish = useCallback(async (hindiText: string): Promise<string> => {
    try {
      setIsTranslating(true);
      const encoded = encodeURIComponent(hindiText);
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encoded}&langpair=hi|en`
      );
      const data = await res.json();
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        return data.responseData.translatedText;
      }
      /* Fallback: return original Hindi if translation fails */
      showVoiceToast("Translation failed. Showing original Hindi text.");
      return hindiText;
    } catch (err) {
      console.warn("Translation error:", err);
      showVoiceToast("Could not translate. Showing original Hindi text.");
      return hindiText;
    } finally {
      setIsTranslating(false);
    }
  }, [showVoiceToast]);

  const toggleVoiceInput = useCallback(() => {
    /* If already recording → stop */
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    /* Check browser support */
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showVoiceToast("Voice input is not supported in this browser. Use Chrome, Edge or Safari.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    /* Set language based on user's selection */
    const isHindi = voiceLang === "hi";
    recognition.lang = isHindi ? "hi-IN" : "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    if (isHindi) {
      showVoiceToast("Hindi mode: Speak in Hindi — it will be translated to English.");
    }

    let finalTranscript = "";

    recognition.onstart = () => {
      setIsRecording(true);
      setInterimTranscript("");
      finalTranscript = "";
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      /* Show interim in input for real-time feedback */
      setInterimTranscript(interim);
      if (finalTranscript) {
        setInput(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      setIsRecording(false);
      setInterimTranscript("");
      recognitionRef.current = null;

      switch (event.error) {
        case "not-allowed":
          showVoiceToast("Microphone access denied. Please allow mic permission in browser settings.");
          break;
        case "no-speech":
          showVoiceToast("No speech detected. Tap the mic and try speaking again.");
          break;
        case "network":
          showVoiceToast("Network unavailable. Please check your internet connection and try again.");
          break;
        case "aborted":
          break;
        default:
          showVoiceToast("Voice input failed. Please try again.");
          break;
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimTranscript("");
      recognitionRef.current = null;

      /* If Hindi mode → translate the final transcript to English */
      if (isHindi && finalTranscript.trim()) {
        setInput(finalTranscript.trim()); // Show Hindi temporarily
        translateToEnglish(finalTranscript.trim()).then(english => {
          setInput(english);
        });
      } else if (finalTranscript.trim()) {
        setInput(finalTranscript.trim());
      }
    };

    /* Start listening */
    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsRecording(false);
      showVoiceToast("Could not start voice input. Please try again.");
    }
  }, [isRecording, voiceLang, showVoiceToast, translateToEnglish]);

  /* Play subtle send sound using Web Audio API */
  const playSendSound = () => {
    if (!settings.soundEffects) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  };

  /* Clear all history */
  const clearAllHistory = () => {
    if (!window.confirm("⚠️ This will permanently delete ALL chat history. Continue?")) return;
    setSessions([]);
    localStorage.removeItem(STORAGE_KEY);
    setMessages([]);
    setFirstScreen(true);
    currentSessionId.current = null;
    setIsSettingsOpen(false);
  };

  /* Auto-save current session on every message change */
  useEffect(() => {
    if (messages.length === 0 || !currentSessionId.current) return;

    const title = (messages.find(m => m.role === "user")?.text ?? "Conversation")
      .trim()
      .slice(0, 60);

    const session: ChatSession = {
      id:       currentSessionId.current,
      title,
      date:     new Date().toISOString(),
      messages,
    };

    setSessions(prev => {
      // Replace existing or prepend
      const others  = prev.filter(s => s.id !== session.id);
      const updated = [session, ...others].slice(0, MAX_SESSIONS);
      persistSessions(updated);
      return updated;
    });
  }, [messages]);

  /* ── Send Handler ──────────────────────────────── */
  const handleSend = async (msgText?: string) => {
    const textToSend = (msgText ?? input).trim();
    if (!textToSend) return;

    /* First message in fresh session → create session id */
    if (firstScreen) {
      currentSessionId.current = Date.now().toString();
      setFirstScreen(false);
    }

    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setMessages(prev => [...prev, { role: "user", text: textToSend, time: nowTime }]);
    setInput("");
    setIsTyping(true);
    playSendSound();

    try {
      const res  = await fetch(BACKEND_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          student_profile: {
            full_name:  localStorage.getItem("user_name"),
            department: localStorage.getItem("user_department"),
            batch:      localStorage.getItem("user_batch"),
            email:      localStorage.getItem("user_id"),
          },
        }),
      });
      const data = await res.json();
      const botTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setMessages(prev => [
        ...prev,
        {
          role:      "bot",
          text:      data.reply ?? "No response received.",
          time:      botTime,
          pdfUrl:    data.pdf,
          quickTags: data.follow_ups ?? [],
          links:     data.links      ?? [],
        },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "bot", text: "⚠️ Server is not responding. Please check your connection.", time: nowTime },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  /* ── Clear (new chat) ──────────────────────────── */
  /* ── Export Chat as Text File ────────────────── */
  const exportChat = () => {
    if (messages.length === 0) return;
    const chatContent = messages.map(m => `[${m.time}] ${m.role.toUpperCase()}: ${m.text}`).join("\n\n");
    const blob = new Blob([chatContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PU_Chat_Export_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Clear (new chat) ──────────────────────────── */
  const clearChat = () => {
    if (messages.length > 0 && !window.confirm("Start a new conversation?")) return;
    setMessages([]);
    setFirstScreen(true);
    currentSessionId.current = null;
  };

  /* ── Restore a past session ────────────────────── */
  const restoreSession = (session: ChatSession) => {
    currentSessionId.current = session.id;
    setMessages(session.messages);
    setFirstScreen(false);
  };

  /* ── Delete a session from history ────────────── */
  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      persistSessions(updated);
      return updated;
    });
    // If deleting the active session, go back to fresh screen
    if (currentSessionId.current === id) clearChat();
  };

  /* ════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════ */
  return (
    <div className="chatpage-container">
      {/* MOBILE CHAT HEADER */}
      <header className="mobile-chat-header">
        <button className="menu-toggle-btn" onClick={() => setIsMobileDrawerOpen(true)}>
          <FiMenu />
        </button>
        <span className="mobile-header-title">PU AI Assistant</span>
        <button className="home-nav-btn" onClick={() => (window.location.href = "/")}>
          <FiHome />
        </button>
      </header>

      {/* MOBILE DRAWER BACKDROP */}
      {isMobileDrawerOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setIsMobileDrawerOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`sidebar ${isMobileDrawerOpen ? "open" : ""}`}>
        {/* Mobile close button in drawer */}
        <button className="drawer-close-btn" onClick={() => setIsMobileDrawerOpen(false)}>
          <FiX />
        </button>

        <img src="/pu-logo.png" className="sidebar-logo" alt="PU Logo" />
        <h2 className="sidebar-title">PU AI Assistant</h2>
        <div className="sidebar-divider" />

        <button className="new-chat-btn-sidebar" onClick={clearChat}>
          <FiPlus style={{ marginRight: "10px" }} /> New Chat
        </button>

        {/* Auth Section */}
        <div className="auth-group">
          {isGuest ? (
            <>
              <button className="guest-btn">Guest Mode</button>
              <button className="login-btn-premium" onClick={() => window.location.href = "/login"}>
                Login
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", width: "100%" }}>
              <div className="sidebar-user-avatar">
                {getUserInitials(profile.full_name)}
              </div>
              <p className="sidebar-user-name" style={{ margin: "10px 0", fontSize: "14px", fontWeight: 600 }}>
                {profile.full_name}
              </p>

              <div className="sidebar-user-details">
                {profile.department && <p><strong>Dept:</strong> {profile.department}</p>}
                {profile.batch && <p><strong>Batch:</strong> {profile.batch}</p>}
                {profile.email && <p><strong>Email:</strong> {profile.email}</p>}
              </div>

              <button
                className="guest-btn"
                style={{ marginTop: "12px" }}
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* ── Recent Inquiries — LIVE from localStorage ── */}
        <div className="recent-chats">
          <p className="recent-title">
            <FiClock style={{ marginRight: "6px", verticalAlign: "middle" }} />
            Recent Inquiries
          </p>

          {sessions.length === 0 ? (
            <p className="no-history-hint">No chats yet. Start asking!</p>
          ) : (
            sessions.map(session => (
              <div
                key={session.id}
                className={`chat-item ${currentSessionId.current === session.id ? "chat-item--active" : ""}`}
                onClick={() => restoreSession(session)}
                title={session.title}
              >
                <FiMessageSquare className="chat-item-icon" />
                <span className="chat-text">{session.title}</span>
                <span className="chat-date">{relativeDate(session.date)}</span>
                <button
                  className="chat-delete-btn"
                  onClick={e => deleteSession(session.id, e)}
                  title="Delete"
                >×</button>
              </div>
            ))
          )}
        </div>

        <footer style={{ marginTop: "auto", fontSize: "10px", opacity: 0.45, textAlign: "center", padding: "10px 0" }}>
          v1.2.0 • Panjab University Official
        </footer>
      </aside>

      {/* ── CENTER CHAT AREA ── */}
      <main className="right-area">
        <header className="chat-header">
          <div className="header-status">
            <div className="online-dot" />
            <span className="header-title">PU AI Assistant</span>
          </div>
          <div className="header-actions">
            <button className="action-btn" onClick={clearChat} title="New Chat"><FiTrash2 /></button>
            <button className="action-btn" onClick={exportChat} title="Export Chat"><FiDownload /></button>
            <button className="action-btn" title="Settings" onClick={() => setIsSettingsOpen(!isSettingsOpen)}><FiSettings /></button>
          </div>
        </header>

        {firstScreen ? (
          <div className="landing-view">
            <img src="/pu-logo.png" className="landing-logo" alt="Background Logo" />
            <h1 className="landing-title">Welcome to PU Assistant</h1>
            <p className="landing-subtitle">
              Your official editorial companion for all things Panjab University.
              Ask me about admissions, fees, campus life, or exam schedules.
            </p>
          </div>
        ) : (
          <div className="chat-body" ref={chatBodyRef}>
            {messages.map((msg, i) => (
              <div key={i}>
                <span className="msg-time-badge">{msg.time}</span>
                <div className={`msg-row ${msg.role}`}>
                  <div className={`msg-bubble ${msg.role}`}>
                    {msg.role === "bot"  && <img src="/pu-logo.png" className="ai-avatar" alt="AI" />}
                    {msg.role === "user" && <div className="user-avatar-circle">{getUserInitials(profile.full_name)}</div>}

                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => (
                          <a {...props} target="_blank" rel="noopener noreferrer"
                             style={{ color: "#8B0000", fontWeight: "600" }} />
                        ),
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>

                    {msg.pdfUrl && (
                      <a href={msg.pdfUrl} className="pdf-btn" target="_blank" rel="noreferrer"
                         style={{ marginTop: "12px", display: "block" }}>
                        📄 Official Document (PDF)
                      </a>
                    )}

                    {msg.role === "bot" && (
                      <>
                        {((msg.links?.length ?? 0) > 0 || (msg.quickTags?.length ?? 0) > 0) && (
                          <div className="suggestion-row">
                            {msg.links?.map((lnk, idx) => (
                              <a key={idx} href={lnk.url} target="_blank" rel="noopener noreferrer"
                                 className="suggestion-chip">
                                🌐 {lnk.label}
                              </a>
                            ))}
                            {msg.quickTags?.map((tag, idx) => (
                              <button key={idx} onClick={() => handleSend(tag)} className="suggestion-chip">
                                ✨ {tag}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="msg-row bot">
                <div className="msg-bubble bot">
                  <img src="/pu-logo.png" className="ai-avatar" alt="AI" />
                  <div className="typing-dots">
                    <div className="dot" /><div className="dot" /><div className="dot" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* INPUT BAR */}
        <div className="chat-input-area">
          {firstScreen && (
            <div className="quick-topics-row" style={{ maxWidth: "900px", margin: "0 auto 15px auto" }}>
              {["Admissions", "Scholarships", "Hostels", "UIET", "Campus Life", "Exams"].map(topic => (
                <button key={topic} className="topic-pill" onClick={() => handleSend(topic)}>{topic}</button>
              ))}
            </div>
          )}

          <div className="input-container">
            <button className="icon-btn"><FiPaperclip /></button>
            <input
              className="chat-input"
              placeholder={
                isTranslating ? "Translating to English..."
                : isRecording && voiceLang === "hi" ? "🎙️ हिंदी सुन रहा है..."
                : isRecording ? "🎙️ Listening..."
                : "Ask anything about Panjab University..."
              }
              value={isRecording && interimTranscript ? (input ? input + " " : "") + interimTranscript : input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => settings.sendOnEnter && e.key === "Enter" && !isTranslating && handleSend()}
              readOnly={isRecording || isTranslating}
            />
            <div className="input-actions">
              <button
                className={`voice-lang-toggle ${voiceLang === "hi" ? "active" : ""}`}
                onClick={() => setVoiceLang(prev => prev === "en" ? "hi" : "en")}
                title={voiceLang === "en" ? "Switch to Hindi voice (translate to English)" : "Switch to English voice"}
                aria-label="Toggle voice language"
              >
                {voiceLang === "hi" ? "हि" : "En"}
              </button>
              <button
                className={`icon-btn ${isRecording ? "recording-pulse" : ""}`}
                onClick={toggleVoiceInput}
                title={isRecording ? "Stop Recording" : `Voice Input (${voiceLang === "hi" ? "Hindi → English" : "English"})`}
                aria-label={isRecording ? "Stop voice recording" : "Start voice input"}
              >
                {isRecording ? <FiMicOff /> : <FiMic />}
              </button>
              <button className="send-btn-premium" onClick={() => handleSend()} disabled={isTranslating}>
                <FiSend />
              </button>
            </div>
          </div>
        </div>
        {/* VOICE TOAST NOTIFICATION */}
        {voiceToast && (
          <div className="voice-toast" role="alert">
            <span className="voice-toast-icon">🎙️</span>
            <span className="voice-toast-text">{voiceToast}</span>
            <button className="voice-toast-close" onClick={() => setVoiceToast(null)}>×</button>
          </div>
        )}
        {/* SETTINGS PANEL */}
        {isSettingsOpen && (
          <div className="settings-backdrop" onClick={() => setIsSettingsOpen(false)} />
        )}
        <div className={`settings-panel ${isSettingsOpen ? 'open' : ''}`}>
          <div className="settings-header">
            <h3 className="settings-title">
              <FiSettings className="settings-title-icon" /> Settings
            </h3>
            <button className="settings-close-btn" onClick={() => setIsSettingsOpen(false)}>
              <FiX />
            </button>
          </div>

          <div className="settings-body">
            {/* ── Appearance ── */}
            <div className="settings-section">
              <h4 className="settings-section-title">🎨 Appearance</h4>

              <div className="settings-item">
                <div className="settings-item-info">
                  {settings.darkMode ? <FiMoon className="settings-icon" /> : <FiSun className="settings-icon" />}
                  <div>
                    <p className="settings-label">Dark Mode</p>
                    <p className="settings-desc">Easy on the eyes at night</p>
                  </div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={settings.darkMode} onChange={() => updateSetting('darkMode', !settings.darkMode)} />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <FiType className="settings-icon" />
                  <div>
                    <p className="settings-label">Font Size</p>
                    <p className="settings-desc">Adjust chat text size</p>
                  </div>
                </div>
                <div className="font-size-selector">
                  {(['small', 'medium', 'large'] as const).map(size => (
                    <button
                      key={size}
                      className={`font-size-btn ${settings.fontSize === size ? 'active' : ''}`}
                      onClick={() => updateSetting('fontSize', size)}
                    >
                      <span style={{ fontSize: size === 'small' ? '11px' : size === 'medium' ? '14px' : '18px', fontWeight: 700 }}>A</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <FiMessageSquare className="settings-icon" />
                  <div>
                    <p className="settings-label">Bubble Style</p>
                    <p className="settings-desc">Change chat bubble look</p>
                  </div>
                </div>
                <div className="bubble-style-selector">
                  {(['modern', 'classic', 'minimal'] as const).map(style => (
                    <button
                      key={style}
                      className={`bubble-style-btn ${settings.bubbleStyle === style ? 'active' : ''}`}
                      onClick={() => updateSetting('bubbleStyle', style)}
                    >
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Behavior ── */}
            <div className="settings-section">
              <h4 className="settings-section-title">⚡ Behavior</h4>

              <div className="settings-item">
                <div className="settings-item-info">
                  <FiSend className="settings-icon" />
                  <div>
                    <p className="settings-label">Send on Enter</p>
                    <p className="settings-desc">Press Enter to send message</p>
                  </div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={settings.sendOnEnter} onChange={() => updateSetting('sendOnEnter', !settings.sendOnEnter)} />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  {settings.soundEffects ? <FiVolume2 className="settings-icon" /> : <FiVolumeX className="settings-icon" />}
                  <div>
                    <p className="settings-label">Sound Effects</p>
                    <p className="settings-desc">Play sound when sending</p>
                  </div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={settings.soundEffects} onChange={() => updateSetting('soundEffects', !settings.soundEffects)} />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <FiZap className="settings-icon" />
                  <div>
                    <p className="settings-label">Animations</p>
                    <p className="settings-desc">Smooth message transitions</p>
                  </div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={settings.messageAnimations} onChange={() => updateSetting('messageAnimations', !settings.messageAnimations)} />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <FiArrowDown className="settings-icon" />
                  <div>
                    <p className="settings-label">Auto-Scroll</p>
                    <p className="settings-desc">Scroll to latest messages</p>
                  </div>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={settings.autoScroll} onChange={() => updateSetting('autoScroll', !settings.autoScroll)} />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>

            {/* ── Data Management ── */}
            <div className="settings-section settings-danger-zone">
              <h4 className="settings-section-title">🗑️ Data Management</h4>

              <div className="settings-item">
                <div className="settings-item-info">
                  <FiDownload className="settings-icon" />
                  <div>
                    <p className="settings-label">Export All Data</p>
                    <p className="settings-desc">Download your chat history</p>
                  </div>
                </div>
                <button className="settings-action-btn" onClick={exportChat}>Export</button>
              </div>

              <div className="settings-item">
                <div className="settings-item-info">
                  <FiAlertTriangle className="settings-icon danger" />
                  <div>
                    <p className="settings-label danger">Clear All History</p>
                    <p className="settings-desc">Permanently delete everything</p>
                  </div>
                </div>
                <button className="settings-action-btn danger" onClick={clearAllHistory}>Clear</button>
              </div>
            </div>

            {/* ── About ── */}
            <div className="settings-about">
              <p>PU AI Assistant v1.2.0</p>
              <p>Panjab University Official</p>
              <p className="settings-about-sub">Made with ❤️ for PU students</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
