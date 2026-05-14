import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import "./Login.css";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      alert(data.message);

      if (res.ok && data.user) {
        localStorage.setItem("user_id", data.user.email);
        localStorage.setItem("user_name", data.user.full_name || "");
        navigate("/chat");
      }
    } catch (err) {
      alert("Login failed. Try again.");
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-left-panel">
        <button className="back-btn-premium" onClick={() => navigate("/")}>
          <FiArrowLeft /> Back to Home
        </button>
        
        <h1 className="login-title">STUDENT LOGIN</h1>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label><FiMail /> Email ID</label>
            <input
              type="email"
              name="email"
              placeholder="email@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label><FiLock /> Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button 
                type="button" 
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn">
            ACCESS PORTAL
          </button>
        </form>

        <a className="register-link" onClick={() => navigate("/register")}>
          Don’t have an account? <strong>Create one now</strong>
        </a>
      </div>

      <div className="auth-right-panel">
        <img src="/pu-heritage-custom.png" alt="Panjab University Heritage" className="auth-right-image" />
        <div className="auth-overlay"></div>
        <div className="auth-content-box">
          <h2>The Intelligence of Tradition.</h2>
          <p>
            Established in 1882, Panjab University stands as a testament to academic excellence 
            and heritage. Join a community of scholars, innovators, and leaders.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
