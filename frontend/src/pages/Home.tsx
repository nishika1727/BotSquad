import { useNavigate } from "react-router-dom";
import { FaCommentDots } from "react-icons/fa";
import React, { useEffect, useState } from "react";
import "./style.css";

function Home() {
  const navigate = useNavigate();

  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const name = localStorage.getItem("user_name");
    setUsername(name);
  }, []);

  const getUserInitials = (name: string | null) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <div className="homepage">
      {/* ✅ Navbar */}
      <header className="navbar">
        <div className="nav-left">HOME</div>

        <div className="nav-right">

          {/* 🔥 Show LOGIN if NOT logged in */}
          {!username ? (
            <button className="login-btn" onClick={() => navigate("/login")}>
              LOG IN
            </button>
          ) : (
            <>
              {/* 🔥 Show Avatar */}
              <div className="nav-avatar">
                {getUserInitials(username)}
              </div>

              {/* 🔥 Show Logout Button */}
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </>
          )}
        </div>
      </header>

      {/* ✅ Hero Section */}
      <main className="hero">
        <div className="hero-left">
          <h1 className="hero-title">CHATBOT</h1>
          <p className="hero-text">
            Your Your intelligent AI assistant for Panjab University delivering accurate, verified, and student-friendly answers about admissions, courses, fees, hostels, scholarships, and campus life all in one place.
          </p>

          <button className="start-btn" onClick={() => navigate("/chat")}>
            GET STARTED NOW
          </button>
        </div>

        <div className="hero-right">
          <img src="/pu-logo.png" alt="PU Logo" className="hero-logo" />
        </div>
      </main>

    
    </div>
  );
}

export default Home;
