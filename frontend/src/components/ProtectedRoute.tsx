import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import type { User } from '@supabase/supabase-js';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowIncomplete?: boolean;
}

export default function ProtectedRoute({ children, allowIncomplete = false }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profileComplete, setProfileComplete] = useState<boolean>(true);

  useEffect(() => {
    supabase.auth.getUser()
      .then(async ({ data }) => {
        const currentUser = data?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const email = currentUser.email;
          
          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, department, batch, course, semester_year, program_type")
              .eq("id", currentUser.id)
              .single();
              
            // Check if profile exists and has all required academic details
            const isComplete = !!(
              profile &&
              profile.full_name &&
              profile.department &&
              profile.batch &&
              profile.course &&
              profile.semester_year &&
              profile.program_type
            );

            setProfileComplete(isComplete);

            // Populate localStorage with whatever is available
            if (email) {
              localStorage.setItem("user_id", email);
              localStorage.setItem("user_email", email);
            }
            if (profile) {
              localStorage.setItem("user_name", profile.full_name || "");
              if (profile.department) localStorage.setItem("user_department", profile.department);
              if (profile.batch) localStorage.setItem("user_batch", profile.batch);
            }
          } catch (err) {
            console.error("Failed to check profile completion:", err);
            // Default to incomplete if profile fetch fails
            setProfileComplete(false);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Authentication error in ProtectedRoute:", err);
        setUser(null);
        setLoading(false);
      });
  }, []);

  if (loading) {
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
        Loading...
      </div>
    );
  }

  // No active session -> redirect to login
  if (!user) return <Navigate to="/login" replace />;

  // User profile incomplete and route doesn't allow incomplete profiles -> redirect to profile completion
  if (!profileComplete && !allowIncomplete) {
    return <Navigate to="/complete-profile" replace />;
  }

  return <>{children}</>;
}
