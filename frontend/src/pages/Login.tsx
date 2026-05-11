import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log("🔵 Sending to backend:", formData);

    try {
      const res = await fetch("http://localhost:5001/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      console.log("🟢 Backend Response:", data);

      alert(data.message);

      // ----------- SAVE USER ID + DETAILS ON SUCCESS -----------
      if (res.ok && data.user) {
        localStorage.setItem("user_id", data.user.email);
        localStorage.setItem("user_department", data.user.department || "");
        localStorage.setItem("user_batch", data.user.batch || "");
        localStorage.setItem("user_name", data.user.full_name || "");

        navigate("/chat");
      }
    } catch (err) {
      console.error("❌ LOGIN ERROR:", err);
      alert("Login failed. Try again.");
    }
  };

  return (
    <div className="login-container">
      <h1 className="login-title">STUDENT LOGIN</h1>

      <form className="login-form" onSubmit={handleSubmit}>
        <label>Email ID</label>
        <input
          type="email"
          name="email"
          placeholder="Enter your email"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <label>Password</label>
        <input
          type="password"
          name="password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={handleChange}
          required
        />

        <button type="submit" className="login-btn">
          LOGIN
        </button>
      </form>

      <a className="register-link" href="/register">
        Don’t have an account? Register
      </a>
    </div>
  );
};

export default Login;
