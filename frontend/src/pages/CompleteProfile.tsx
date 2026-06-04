import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FiArrowLeft, FiUser, FiBook, FiHash, 
  FiHome, FiLayers, FiClock, FiStar 
} from "react-icons/fi";
import { supabase } from "../supabaseClient";
import "./register.css"; // Reuse the registration form's styles for consistency

const CompleteProfile: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    batch: "",
    department: "",
    course: "",
    semester_year: "",
    program_type: "",
    hostel: "",
    category: "",
  });

  useEffect(() => {
    const fetchProfileAndMetadata = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const metadata = user.user_metadata;
          const oauthName = metadata?.full_name || metadata?.name || "";

          // Fetch existing profile data if any
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

          if (error) {
            console.error("Error retrieving existing profile:", error);
          }

          if (profile) {
            // Profile exists -> user is editing
            setIsEditing(true);
            setFormData({
              fullName: profile.full_name || oauthName,
              batch: profile.batch || "",
              department: profile.department || "",
              course: profile.course || "",
              semester_year: profile.semester_year || "",
              program_type: profile.program_type || "",
              hostel: profile.hostel || "",
              category: profile.category || "",
            });
          } else {
            // No profile yet -> pre-fill name from OAuth if available
            setIsEditing(false);
            setFormData(prev => ({
              ...prev,
              fullName: oauthName || prev.fullName,
            }));
          }
        }
      } catch (err) {
        console.error("Unexpected error loading user/profile data:", err);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchProfileAndMetadata();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Session not found. Please log in again.");
        navigate("/login");
        return;
      }

      // Upsert profiles table with the personalization credentials
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          full_name: formData.fullName,
          batch: formData.batch,
          department: formData.department,
          course: formData.course,
          semester_year: formData.semester_year,
          program_type: formData.program_type,
          hostel: formData.hostel || null,
          category: formData.category || null,
          email: user.email,
        });

      if (profileError) {
        console.error("Profile upsert error:", profileError);
        alert("Failed to save profile: " + profileError.message);
        return;
      }

      // Synchronize values in local storage for chatbot
      localStorage.setItem("user_id", user.email!);
      localStorage.setItem("user_email", user.email!);
      localStorage.setItem("user_name", formData.fullName);
      localStorage.setItem("user_department", formData.department);
      localStorage.setItem("user_batch", formData.batch);

      alert(isEditing ? "Profile updated successfully!" : "Academic profile set up successfully!");
      navigate("/");
    } catch (err) {
      alert("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#0a0a0a',
        color: '#fff',
        fontSize: '1.2rem',
      }}>
        Loading profile data...
      </div>
    );
  }

  return (
    <div className="register-container" style={{ position: 'relative' }}>
      {/* Premium Return Button */}
      <button 
        type="button"
        onClick={() => navigate("/")} 
        style={{
          position: 'absolute',
          top: '30px',
          left: '30px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.9)',
          border: '1.5px solid var(--border-light)',
          padding: '10px 18px',
          borderRadius: '30px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontWeight: 700,
          color: 'var(--text-main)',
          fontSize: '14px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
          transition: 'all 0.3s var(--ease-out)',
          zIndex: 10
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateX(-3px)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)';
          e.currentTarget.style.borderColor = 'var(--crimson-primary)';
          e.currentTarget.style.color = 'var(--crimson-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)';
          e.currentTarget.style.borderColor = 'var(--border-light)';
          e.currentTarget.style.color = 'var(--text-main)';
        }}
      >
        <FiArrowLeft /> BACK TO PORTAL
      </button>

      <h2 className="register-title">{isEditing ? "EDIT YOUR PROFILE" : "COMPLETE YOUR PROFILE"}</h2>
      <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '30px', maxWidth: '600px', margin: '0 auto 30px auto' }}>
        {isEditing 
          ? "Update your official academic credentials to ensure your personalized chatbot reports are accurate."
          : "Please provide your official university academic credentials to personalize your experience."}
      </p>

      <form className="register-form" onSubmit={handleSubmit}>
        
        {/* Section 1: Academic Identity */}
        <div className="form-header-section">
          <h3>Academic Identity</h3>
          <p>Provide your official department and enrollment credentials.</p>
        </div>

        <div className="form-group">
          <label><FiUser /> Full Name</label>
          <input 
            name="fullName" 
            type="text" 
            placeholder="John Doe" 
            value={formData.fullName} 
            onChange={handleChange} 
            required 
          />
        </div>

        <div className="form-group">
          <label><FiHash /> Batch</label>
          <input 
            name="batch" 
            type="text" 
            placeholder="2023–2027" 
            value={formData.batch} 
            onChange={handleChange} 
            required 
          />
        </div>

        <div className="form-group">
          <label><FiLayers /> Department</label>
          <input 
            name="department" 
            type="text" 
            placeholder="e.g. UIET" 
            value={formData.department} 
            onChange={handleChange} 
            required 
          />
        </div>

        <div className="form-group">
          <label><FiBook /> Course / Programme</label>
          <input 
            name="course" 
            type="text" 
            placeholder="e.g. B.E CSE" 
            value={formData.course} 
            onChange={handleChange} 
            required 
          />
        </div>

        <div className="form-group">
          <label><FiClock /> Semester / Year</label>
          <input 
            name="semester_year" 
            type="text" 
            placeholder="e.g. 6th Sem" 
            value={formData.semester_year} 
            onChange={handleChange} 
            required 
          />
        </div>

        <div className="form-group">
          <label><FiLayers /> Program Type</label>
          <input 
            name="program_type" 
            type="text" 
            placeholder="UG / PG" 
            value={formData.program_type} 
            onChange={handleChange} 
            required 
          />
        </div>

        {/* Section 2: Campus Residence */}
        <div className="form-header-section">
          <h3>Campus Residence</h3>
          <p>Optional details for hostel and category services.</p>
        </div>

        <div className="form-group">
          <label><FiHome /> Hostel (Optional)</label>
          <input 
            name="hostel" 
            type="text" 
            placeholder="e.g. BH8" 
            value={formData.hostel} 
            onChange={handleChange} 
          />
        </div>

        <div className="form-group">
          <label><FiStar /> Category (Optional)</label>
          <input 
            name="category" 
            type="text" 
            placeholder="e.g. GEN / OBC" 
            value={formData.category} 
            onChange={handleChange} 
          />
        </div>

        <button 
          type="submit" 
          className="register-btn" 
          disabled={loading}
          style={{ gridColumn: 'span 2', marginTop: '20px' }}
        >
          {loading 
            ? (isEditing ? "SAVING CHANGES..." : "SAVING PROFILE...") 
            : (isEditing ? "SAVE CHANGES" : "COMPLETE SETUP")}
        </button>
      </form>
    </div>
  );
};

export default CompleteProfile;
