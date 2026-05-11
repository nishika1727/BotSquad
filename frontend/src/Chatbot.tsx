import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { FiSend } from "react-icons/fi";
import "./index.css";

type LinkItem = {
  label: string;
  url: string;
};

type Message = {
  role: "bot" | "user";
  text: string;
  time: string;
  quickTags?: string[];
  pdfUrl?: string;
  links?: LinkItem[];
};

const BACKEND_URL = "http://127.0.0.1:5000/api/chat";

// USER INITIALS
const getUserInitials = (name: string | null) => {
  if (!name) return "U";
  const parts = name.trim().split(" ");
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[1][0]).toUpperCase();
};

const App = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [firstScreen, setFirstScreen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);

  const profile = {
    full_name: localStorage.getItem("user_name"),
    department: localStorage.getItem("user_department"),
    batch: localStorage.getItem("user_batch"),
    email: localStorage.getItem("user_email"),
  };

  const isGuest = !profile.full_name;

  const chatBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBodyRef.current?.scrollTo({
      top: chatBodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isTyping]);

  // SEND MESSAGE ---------------------------
  const handleSend = async (msgText?: string) => {
    if (firstScreen) {
      setFirstScreen(false);

      setMessages([
        {
          role: "bot",
          text: "Hi! I'm PU Assistant. How can I help you today?",
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          quickTags: ["Admission Process", "Fee Structure", "Course Details"],
        },
      ]);
    }

    const textToSend = msgText || input;
    if (!textToSend.trim()) return;

    const nowTime = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setMessages((prev) => [
      ...prev,
      { role: "user", text: textToSend, time: nowTime },
    ]);

    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          student_profile: {
            full_name: localStorage.getItem("user_name"),
            department: localStorage.getItem("user_department"),
            batch: localStorage.getItem("user_batch"),
            email: localStorage.getItem("user_id"),
          },
        }),
      });

      const data = await res.json();

      const botTime = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      // BOT MESSAGE
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: data.reply || "No response received.",
          time: botTime,
          pdfUrl: data.pdf,
          quickTags: data.follow_ups ?? [],
          links: data.links ?? [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "⚠️ Server is not responding. Please try again later.",
          time: nowTime,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="chatpage-container">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <img src="/pu-logo.png" className="sidebar-logo" />
        <h2 className="sidebar-title">PU AI Assistant</h2>

        {isGuest ? (
          <>
            <div className="guest-badge">Guest Mode</div>
            <button
              className="login-btn"
              onClick={() => (window.location.href = "/login")}
            >
              Login
            </button>
          </>
        ) : (
          <>
            <div className="sidebar-user-avatar">
              {getUserInitials(profile.full_name)}
            </div>
            <p className="sidebar-user-name">{profile.full_name}</p>
            <button
              className="logout-btn"
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
            >
              Logout
            </button>
          </>
        )}
      </aside>

      {/* MAIN CHAT AREA */}
      <div className="right-area">
        {firstScreen ? (
          <div className="first-screen">
            <h1 className="first-title">
              Hi! I'm PU Assistant. How can I help you today?
            </h1>

            <div className="first-input-box">
              <input
                type="text"
                placeholder="Ask anything"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button onClick={() => handleSend()}>
                <FiSend />
              </button>
            </div>

            <div className="static-quick-tags landing">
              <span onClick={() => handleSend("Admission Process")}>
                Admission Process
              </span>
              <span onClick={() => handleSend("Fee Structure")}>
                Fee Structure
              </span>
              <span onClick={() => handleSend("Course Details")}>
                Course Details
              </span>
            </div>
          </div>
        ) : (
          <div className="chat-area">
            <div className="chat-body" ref={chatBodyRef}>
              {messages.map((msg, i) => (
                <div key={i} className={`msg-row ${msg.role}`}>
                  <div className={`msg-bubble ${msg.role}`}>
                    {/* BOT / USER TEXT */}
                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => (
                          <a
                            {...props}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#0056b3", fontWeight: "600" }}
                          />
                        ),
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>

                    {/* PDF */}
                    {msg.pdfUrl && (
                      <a
                        href={msg.pdfUrl}
                        className="pdf-btn"
                        target="_blank"
                        rel="noreferrer"
                      >
                        📄 Download PDF
                      </a>
                    )}

                    {/* 🔗 LINK BUTTONS */}
                    {msg.role === "bot" &&
                      msg.links &&
                      msg.links.length > 0 && (
                        <div className="quick-tags">
                          {msg.links.map((lnk, idx) => (
                            <a
                              key={idx}
                              href={lnk.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="quick-tag-link"
                            >
                              {lnk.label}
                            </a>
                          ))}
                        </div>
                      )}

                    {/* QUICK TAGS */}
                    {msg.role === "bot" &&
                      msg.quickTags &&
                      msg.quickTags.length > 0 && (
                        <div className="quick-tags">
                          {msg.quickTags.map((tag, idx) => (
                            <span key={idx} onClick={() => handleSend(tag)}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                    <div className="msg-time">{msg.time}</div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="msg-row bot">
                  <div className="msg-bubble bot typing">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
            </div>

            {/* INPUT AREA */}
            <div className="chat-input-area">
              <input
                className="chat-input"
                placeholder="Type your message here..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button className="send-btn" onClick={() => handleSend()}>
                <FiSend />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
