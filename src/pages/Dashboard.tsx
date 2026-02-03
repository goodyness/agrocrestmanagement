import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import WorkerDashboard from "@/components/dashboard/WorkerDashboard";
import SuspensionOverlay from "@/components/dashboard/SuspensionOverlay";

interface UserProfile {
  role: string;
  name: string;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      // Fetch user profile to get role and suspension status
      const fetchUserProfile = async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("role, name, is_suspended, suspended_at, suspended_reason")
          .eq("id", user.id)
          .single();

        if (!error && data) {
          setUserProfile(data);
        }
        setLoading(false);
      };

      fetchUserProfile();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show suspension overlay for suspended users (works for workers)
  if (userProfile?.is_suspended) {
    return (
      <SuspensionOverlay
        userName={userProfile.name || "User"}
        userEmail={user?.email || ""}
        reason={userProfile.suspended_reason || "No reason provided"}
        suspendedAt={userProfile.suspended_at || new Date().toISOString()}
      />
    );
  }

  if (userProfile?.role === "admin") {
    return <AdminDashboard user={user} />;
  }

  return <WorkerDashboard user={user} />;
};

export default Dashboard;