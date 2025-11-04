import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { User } from "@supabase/supabase-js";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center jato-hero">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[hsl(var(--jato-blue))] jato-pulse"></div>
          <div className="absolute inset-0 animate-pulse-glow rounded-full jato-glass"></div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full jato-theme-background">
        <AppSidebar user={user} />
        <main className="flex-1 overflow-auto custom-scrollbar jato-main-content">
          <header className="sticky top-0 z-10 h-16 jato-nav flex items-center px-6">
            <SidebarTrigger />
            <div className="ml-4 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(var(--jato-blue))] to-[hsl(var(--jato-orange))] flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <h1 className="text-xl font-semibold jato-logo">
                AIVA
              </h1>
            </div>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>
          <div className="p-6 md:p-8 jato-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;