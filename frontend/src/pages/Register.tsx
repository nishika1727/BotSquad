import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FiArrowLeft, FiUser, FiBook, FiHash, 
  FiMail, FiLock, FiHome, FiLayers, FiClock, FiStar, FiEye, FiEyeOff 
} from "react-icons/fi";
import { supabase } from "../supabaseClient";
import "./register.css";

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;

    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    const payload = {
      fullName: (form.elements.namedItem("fullName") as HTMLInputElement).value,
      batch: (form.elements.namedItem("batch") as HTMLInputElement).value,
      department: (form.elements.namedItem("department") as HTMLInputElement).value,
      course: (form.elements.namedItem("course") as HTMLInputElement).value,
      semester_year: (form.elements.namedItem("semester_year") as HTMLInputElement).value,
      program_type: (form.elements.namedItem("program_type") as HTMLInputElement).value,
      hostel: (form.elements.namedItem("hostel") as HTMLInputElement).value,
      category: (form.elements.namedItem("category") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      password: password,
    };

    setLoading(true);
    try {
      // 1. Supabase Auth signup
      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
      });

      if (error) {
        alert(error.message);
        return;
      }

      // 2. Profile table mein extra student data insert karo
      if (data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: data.user.id,
            full_name: payload.fullName,
            batch: payload.batch,
            department: payload.department,
            course: payload.course,
            semester_year: payload.semester_year,
            program_type: payload.program_type,
            hostel: payload.hostel,
            category: payload.category,
            email: payload.email,
          });

        if (profileError) {
          console.error("Profile insert error:", profileError);
          alert("Account created but profile save failed. Contact support.");
        }
      }

      alert("Registration successful! Please check your email to verify your account.");
      navigate("/login");
    } catch (err) {
      alert("Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <button className="back-btn-premium" onClick={() => navigate("/")}>
        <FiArrowLeft /> Back to Home
      </button>
      
      <h2 className="register-title">STUDENT REGISTRATION</h2>

      <form className="register-form" onSubmit={handleSubmit}>
        
        {/* Section 1: Academic Identity */}
        <div className="form-header-section">
          <h3>Academic Identity</h3>
          <p>Provide your official department and enrollment credentials.</p>
        </div>

        <div className="form-group">
          <label><FiUser /> Full Name</label>
          <input name="fullName" type="text" placeholder="John Doe" required />
        </div>

        <div className="form-group">
          <label><FiHash /> Batch</label>
          <input name="batch" type="text" placeholder="2023–2027" required />
        </div>

        <div className="form-group">
          <label><FiLayers /> Department</label>
          <input name="department" type="text" placeholder="e.g. UIET" required />
        </div>

        <div className="form-group">
          <label><FiBook /> Course / Programme</label>
          <input name="course" type="text" placeholder="e.g. B.E CSE" required />
        </div>

        <div className="form-group">
          <label><FiClock /> Semester / Year</label>
          <input name="semester_year" type="text" placeholder="e.g. 6th Sem" required />
        </div>

        <div className="form-group">
          <label><FiLayers /> Program Type</label>
          <input name="program_type" type="text" placeholder="UG / PG" required />
        </div>

        {/* Section 2: Campus Residence */}
        <div className="form-header-section">
          <h3>Campus Residence</h3>
          <p>Optional details for hostel and category services.</p>
        </div>

        <div className="form-group">
          <label><FiHome /> Hostel (Optional)</label>
          <input name="hostel" type="text" placeholder="e.g. BH8" />
        </div>

        <div className="form-group">
          <label><FiStar /> Category (Optional)</label>
          <input name="category" type="text" placeholder="e.g. GEN / OBC" />
        </div>

        {/* Section 3: Secure Access */}
        <div className="form-header-section">
          <h3>Secure Access</h3>
          <p>Used for official portal authentication and notifications.</p>
        </div>

        <div className="form-group full-width">
          <label><FiMail /> Email ID</label>
          <input name="email" type="email" placeholder="email@example.com" required />
        </div>

        <div className="form-group">
          <label><FiLock /> Password</label>
          <div className="password-input-wrapper">
            <input 
              name="password" 
              type={showPassword ? "text" : "password"} 
              placeholder="Create password" 
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

        <div className="form-group">
          <label><FiLock /> Confirm Password</label>
          <div className="password-input-wrapper">
            <input 
              name="confirmPassword" 
              type={showConfirmPassword ? "text" : "password"} 
              placeholder="Repeat password" 
              required 
            />
            <button 
              type="button" 
              className="password-toggle-btn"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </div>

        <button type="submit" className="register-btn" disabled={loading}>
          {loading ? "INITIALIZING..." : "JOIN THE COMMUNITY"}
        </button>
      </form>

      <a className="register-link" onClick={() => navigate("/login")} style={{ marginBottom: '80px' }}>
        Already have an account? <strong>Login Here</strong>
      </a>
    </div>
  );
};

export default Register;
