import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./register.css";

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const form = e.target as HTMLFormElement;

    // Extract values safely
    const fullName = (form.elements.namedItem("fullName") as HTMLInputElement).value;
    const batch = (form.elements.namedItem("batch") as HTMLInputElement).value;
    const department = (form.elements.namedItem("department") as HTMLInputElement).value;
    const course = (form.elements.namedItem("course") as HTMLInputElement).value;
    const semester_year = (form.elements.namedItem("semester_year") as HTMLInputElement).value;
    const program_type = (form.elements.namedItem("program_type") as HTMLInputElement).value;
    const hostel = (form.elements.namedItem("hostel") as HTMLInputElement).value;
    const category = (form.elements.namedItem("category") as HTMLInputElement).value;

    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const confirmPassword = (form.elements.namedItem("confirmPassword") as HTMLInputElement).value;

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:5001/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          batch,
          department,
          course,
          semester_year,
          program_type,
          hostel,
          category,
          email,
          password,
        }),
      });

      const data = await res.json();
      alert(data.message);

      if (res.ok) {
        // Save basic data for personalization
        localStorage.setItem("user_id", email);
        localStorage.setItem("user_name", fullName);
        localStorage.setItem("user_department", department);
        localStorage.setItem("user_batch", batch);
        localStorage.setItem("user_course", course);
        localStorage.setItem("user_semester", semester_year);
        localStorage.setItem("user_program", program_type);

        navigate("/login");
      }
    } catch (err) {
      console.error(err);
      alert("Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <h2>Student Registration</h2>

      <form className="register-form" onSubmit={handleSubmit}>
        
        <label>
          Full Name
          <input name="fullName" type="text" placeholder="Enter full name" required />
        </label>

        <label>
          Batch
          <input name="batch" type="text" placeholder="2023–2027" required />
        </label>

        <label>
          Department
          <input name="department" type="text" placeholder="UIET / UBS / UILS" required />
        </label>

        <label>
          Course / Programme
          <input name="course" type="text" placeholder="B.E CSE / MBA / BA LLB" required />
        </label>

        <label>
          Semester / Year
          <input name="semester_year" type="text" placeholder="6th Sem / 3rd Year" required />
        </label>

        <label>
          Program Type
          <input name="program_type" type="text" placeholder="UG / PG / PhD" required />
        </label>

        <label>
          Hostel (Optional)
          <input name="hostel" type="text" placeholder="e.g. Boys Hostel 8" />
        </label>

        <label>
          Category (Optional)
          <input name="category" type="text" placeholder="GEN / OBC / SC" />
        </label>

        <label>
          Email ID
          <input name="email" type="email" placeholder="Enter email" required />
        </label>

        <label>
          Password
          <input name="password" type="password" placeholder="Enter password" required />
        </label>

        <label>
          Confirm Password
          <input name="confirmPassword" type="password" placeholder="Confirm password" required />
        </label>

        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      <p className="switch-auth">
        Already have an account?{" "}
        <span className="link" onClick={() => navigate("/login")}>
          Login
        </span>
      </p>
    </div>
  );
};

export default Register;
