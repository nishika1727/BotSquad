import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  FiSend,
  FiPaperclip,
  FiMic,
  FiTrash2,
  FiDownload,
  FiSettings,
  FiMessageSquare,
  FiClock,
  FiPlus,
  FiMenu,
  FiX} from "react-icons/fi";
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
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [sessions,     setSessions]     = useState<ChatSession[]>(loadSessions);
  const [input,        setInput]        = useState("");
  const [firstScreen,  setFirstScreen]  = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTyping,     setIsTyping]     = useState(false);
  const [isRecording,  setIsRecording]  = useState(false);

  const chatBodyRef      = useRef<HTMLDivElement>(null);
  const currentSessionId = useRef<string | null>(null);

  const profile = {
    full_name:  localStorage.getItem("user_name"),
    department: localStorage.getItem("user_department"),
    batch:      localStorage.getItem("user_batch"),
    email:      localStorage.getItem("user_email"),
  };
  const isGuest = !profile.full_name;

  /* Auto-scroll on new messages */
  useEffect(() => {
    chatBodyRef.current?.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

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
    <div className={`chatpage-container ${isSidebarOpen ? "sidebar-open" : ""}`}>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* ── LEFT SIDEBAR ── */}
      <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        {/* Mobile Sidebar Close Button */}
        <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)} title="Close Menu">
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
            <div style={{ textAlign: "center" }}>
              <div className="user-avatar-sidebar">{getUserInitials(profile.full_name)}</div>
              <p style={{ margin: "10px 0", fontSize: "14px", fontWeight: 600 }}>{profile.full_name}</p>
              <button
                className="guest-btn"
                onClick={() => { localStorage.clear(); window.location.reload(); }}
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
            <button className="menu-toggle-btn" onClick={() => setIsSidebarOpen(true)} title="Open Menu">
              <FiMenu />
            </button>
            <div className="online-dot" />
            <span className="header-title">PU AI Assistant</span>
          </div>
          <div className="header-actions">
            <button className="action-btn" onClick={clearChat} title="New Chat"><FiTrash2 /></button>
            <button className="action-btn" onClick={exportChat} title="Export Chat"><FiDownload /></button>
            <button className="action-btn" title="Settings"><FiSettings /></button>
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
              placeholder="Ask anything about Panjab University..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
            />
            <div className="input-actions">
              <button
                className={`icon-btn ${isRecording ? "recording-pulse" : ""}`}
                onClick={() => setIsRecording(!isRecording)}
                title={isRecording ? "Stop Recording" : "Voice Input"}
              >
                <FiMic />
              </button>
              <button className="send-btn-premium" onClick={() => handleSend()}>
                <FiSend />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
