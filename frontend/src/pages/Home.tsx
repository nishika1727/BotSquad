import { useNavigate } from "react-router-dom";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { FiCpu, FiBookOpen, FiActivity, FiGlobe, FiShield, FiTrendingUp, FiLogOut, FiMessageSquare, FiEdit3 } from "react-icons/fi";
import "./style.css";

/* ════════════════════════════════════════
   MAGNETIC REPULSION PARTICLE FIELD
   - Cursor acts as a repulsion force field
   - Particles push away, spring back
   - Constellation lines between near particles
   - Cursor aura glow ring
   ════════════════════════════════════════ */
interface BgParticle {
  x: number; y: number;
  vx: number; vy: number;
  baseVx: number; baseVy: number;   // natural drift velocity
  radius: number;
  opacity: number;
  opacityDir: number;
  colorRgb: string;
}

const BG_COLORS_RGB = [
  '139, 0, 0',     // crimson
  '180, 20, 20',   // light crimson
  '212, 175, 55',  // gold
  '180, 150, 35',  // deep gold
  '15, 23, 42',    // navy
];

const REPEL_RADIUS = 130;   // pixels — force field size
const REPEL_FORCE  = 3.5;   // push strength
const MAX_VEL      = 6;     // max particle speed
const DAMPING      = 0.92;  // velocity decay per frame
const COUNT        = 160;   // total particles

const MagneticParticleField: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafId     = useRef<number>(0);
  const mouse     = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Track mouse position
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => { mouse.current = { x: -999, y: -999 }; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);

    // Spawn particle field
    const pts: BgParticle[] = Array.from({ length: COUNT }, () => {
      const vx = (Math.random() - 0.5) * 0.5;
      const vy = (Math.random() - 0.5) * 0.5;
      return {
        x:          Math.random() * window.innerWidth,
        y:          Math.random() * window.innerHeight,
        vx, vy,
        baseVx:     vx,
        baseVy:     vy,
        radius:     2.5 + Math.random() * 4.5,
        opacity:    0.08 + Math.random() * 0.22,
        opacityDir: Math.random() > 0.5 ? 1 : -1,
        colorRgb:   BG_COLORS_RGB[Math.floor(Math.random() * BG_COLORS_RGB.length)],
      };
    });

    const CONNECT_DIST = 140;

    const loop = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const mx = mouse.current.x;
      const my = mouse.current.y;
      const hasMouse = mx > 0 && my > 0;


      // ── Update & draw particles ─────────────
      for (const p of pts) {

        // Magnetic repulsion
        if (hasMouse) {
          const dx   = p.x - mx;
          const dy   = p.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < REPEL_RADIUS && dist > 0.5) {
            const force  = (1 - dist / REPEL_RADIUS) * REPEL_FORCE;
            const nx     = dx / dist;
            const ny     = dy / dist;
            p.vx += nx * force;
            p.vy += ny * force;
          }
        }

        // Gently pull back toward base drift velocity (spring return)
        p.vx += (p.baseVx - p.vx) * 0.012;
        p.vy += (p.baseVy - p.vy) * 0.012;

        // Velocity cap
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > MAX_VEL) {
          p.vx = (p.vx / spd) * MAX_VEL;
          p.vy = (p.vy / spd) * MAX_VEL;
        }

        // Apply damping
        p.vx *= DAMPING;
        p.vy *= DAMPING;

        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Soft wrap-around edges
        if (p.x < -10)  p.x = W + 10;
        if (p.x > W+10) p.x = -10;
        if (p.y < -10)  p.y = H + 10;
        if (p.y > H+10) p.y = -10;

        // Opacity breathing
        p.opacity += p.opacityDir * 0.002;
        if (p.opacity > 0.32 || p.opacity < 0.05) p.opacityDir *= -1;

        // Draw particle with glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle   = `rgba(${p.colorRgb}, ${p.opacity})`;
        ctx.shadowColor = `rgba(${p.colorRgb}, ${p.opacity * 0.5})`;
        ctx.shadowBlur  = 12;
        ctx.fill();
        ctx.shadowBlur  = 0;
      }

      // ── Constellation lines ─────────────────
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx   = pts[i].x - pts[j].x;
          const dy   = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.07;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(139, 0, 0, ${alpha})`;
            ctx.lineWidth   = 0.5;
            ctx.stroke();
          }
        }
      }

      rafId.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(rafId.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
};

/* ════════════════════════════════════════
   SMOOTH COUNT-UP COMPONENT
   ════════════════════════════════════════ */
const CountUp: React.FC<{ end: number; duration?: number; suffix?: string }> = ({
  end, duration = 2200, suffix = ""
}) => {
  const [count, setCount]     = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setStarted(true); },
      { threshold: 0.1 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let startTime: number | null = null;
    const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      setCount(Math.floor(easeOutQuint(p) * end));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, end, duration]);

  return <span ref={ref} className="counter-text">{count}{suffix}</span>;
};

/* ════════════════════════════════════════
   MAIN HOME COMPONENT
   ════════════════════════════════════════ */
const Home: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const profile = {
    full_name:  localStorage.getItem("user_name"),
    department: localStorage.getItem("user_department"),
    batch:      localStorage.getItem("user_batch"),
    email:      localStorage.getItem("user_email") || localStorage.getItem("user_id"),
  };

  useEffect(() => {
    const name = localStorage.getItem("user_name");
    setUsername(name);
  }, []);

  // Close dropdown when clicking outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
      setProfileOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

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

      {/* ── MAGNETIC REPULSION PARTICLE FIELD ── */}
      <MagneticParticleField />

      {/* ── SOFT GRADIENT ORBS + RINGS (CSS) ── */}
      <div className="bg-scene" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="ring ring-1" />
        <div className="ring ring-2" />
        <div className="ring ring-3" />
        <div className="bg-grid" />
      </div>

      {/* Navbar */}
      <header className="navbar">
        <div className="nav-left">
          <img src="/pu-logo.png" alt="PU Logo" className="nav-logo-small" />
          Panjab University
        </div>
        <div className="nav-right">
          {!username ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="nav-register-btn" onClick={() => navigate("/register")}>
                REGISTER
              </button>
              <button className="login-btn" onClick={() => navigate("/login")}>
                PORTAL LOGIN
              </button>
            </div>
          ) : (
            <div className="profile-dropdown-wrapper" ref={profileRef}>
              <button
                className="nav-avatar-btn"
                onClick={() => setProfileOpen(!profileOpen)}
                aria-label="Open profile menu"
              >
                <div className="nav-avatar-circle">
                  {getUserInitials(username)}
                </div>
                <span className="nav-avatar-name">{username.split(" ")[0]}</span>
                <svg className={`nav-avatar-chevron ${profileOpen ? 'open' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {/* ── PROFILE DROPDOWN CARD ── */}
              <div className={`profile-dropdown ${profileOpen ? 'open' : ''}`}>
                <div className="profile-dropdown-header">
                  <div className="profile-dropdown-avatar">
                    {getUserInitials(username)}
                  </div>
                  <div className="profile-dropdown-info">
                    <h4>{profile.full_name || "Student"}</h4>
                    <p>{profile.email || "—"}</p>
                  </div>
                </div>

                <div className="profile-dropdown-divider" />

                <div className="profile-dropdown-details">
                  {profile.department && (
                    <div className="profile-detail-row">
                      <span className="profile-detail-label">Department</span>
                      <span className="profile-detail-value">{profile.department}</span>
                    </div>
                  )}
                  {profile.batch && (
                    <div className="profile-detail-row">
                      <span className="profile-detail-label">Batch</span>
                      <span className="profile-detail-value">{profile.batch}</span>
                    </div>
                  )}
                </div>

                <div className="profile-dropdown-divider" />

                <div className="profile-dropdown-actions">
                  <button className="profile-action-btn" onClick={() => { setProfileOpen(false); navigate("/chat"); }}>
                    <FiMessageSquare /> AI Assistant
                  </button>
                  <button className="profile-action-btn" onClick={() => { setProfileOpen(false); navigate("/complete-profile"); }}>
                    <FiEdit3 /> Edit Profile
                  </button>
                </div>

                <div className="profile-dropdown-divider" />

                <button className="profile-logout-btn" onClick={handleLogout}>
                  <FiLogOut /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="hero-container">
        <main className="hero-main">
          <div className="hero-left">
            <h1 className="hero-title">
              The Intelligence <span>of Tradition.</span>
            </h1>
            <p className="hero-text">
              Bridge 140 years of academic legacy with next-gen AI.
              Get instant, verified institutional intelligence tailored for the Panjab University community.
            </p>
            <button className="start-btn" onClick={() => navigate("/chat")}>
              ENTER ASSISTANT
            </button>
          </div>
          <div className="hero-right">
            <div className="logo-glow-ring"></div>
            <img src="/pu-logo.png" alt="PU Crest" className="hero-logo" />
          </div>
        </main>
      </section>

      {/* Stats */}
      <section className="stats-section">
        <div className="stat-item">
          <h4><CountUp end={140} suffix="+" /></h4>
          <p>Years of Glory</p>
        </div>
        <div className="stat-item">
          <h4>A++</h4>
          <p>Institutional Excellence</p>
        </div>
        <div className="stat-item">
          <h4><CountUp end={25} suffix="K+" /></h4>
          <p>Scholars Enrolled</p>
        </div>
        <div className="stat-item">
          <h4><CountUp end={78} /></h4>
          <p>Elite Departments</p>
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <h2 className="section-title">Core Intelligence</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon"><FiBookOpen /></div>
            <h5>Academic Data</h5>
            <p>Precise information on syllabus, course regulations, and department updates.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FiCpu /></div>
            <h5>AI fine-tuned</h5>
            <p>LLM engines specialized in Panjab University's administrative and historical data.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FiShield /></div>
            <h5>Verified Source</h5>
            <p>Every response is cross-checked with official university repositories.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FiActivity /></div>
            <h5>Live Schedules</h5>
            <p>Real-time date-sheets, exam results, and administrative notifications.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FiGlobe /></div>
            <h5>Campus Intel</h5>
            <p>Hostel info, library timings, and student activity centers navigation.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon"><FiTrendingUp /></div>
            <h5>Career Pathways</h5>
            <p>Placement statistics, recruiter insights, and internship data analysis.</p>
          </div>
        </div>
      </section>

      <footer>
        <p>© 2026 PANJAB UNIVERSITY • CHANDIGARH • ESTABLISHED 1882</p>
      </footer>
    </div>
  );
};

export default Home;
