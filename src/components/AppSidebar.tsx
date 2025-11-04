import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  FolderOpen, 
  Upload, 
  BarChart3, 
  MessageSquare, 
  LogOut,
  Image,
  ShieldCheck
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Assets", url: "/dashboard/assets", icon: Image },
  { title: "Folders", url: "/dashboard/folders", icon: FolderOpen },
  { title: "Upload", url: "/dashboard/upload", icon: Upload },
  { title: "Analytics", url: "/dashboard/analytics", icon: BarChart3 },
  { title: "AIVA Assistant", url: "/dashboard/chat", icon: MessageSquare },
  { title: "FakeBuster", url: "/dashboard/fakebuster", icon: ShieldCheck },
];

interface AppSidebarProps {
  user: User | null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const { open } = useSidebar();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  return (
    <Sidebar 
      collapsible="icon" 
      className={`${open ? "w-64" : "w-16"} nav-sidebar-enhanced border-r border-gray-200/50 backdrop-blur-xl bg-white/80 transition-all duration-300 shadow-xl`}
    >
      <SidebarContent className="py-6">
        {/* Brand Section */}
        <div className="px-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            {open && (
              <div className="nav-brand-text">
                <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  AIVA
                </h2>
                <p className="text-xs text-gray-500 font-medium">Digital Assets</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="px-4 mb-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-3">
            <SidebarMenu className="space-y-2">
              {menuItems.map((item, index) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className={({ isActive }) =>
                        `nav-menu-item group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 relative overflow-hidden ${
                          isActive
                            ? "nav-menu-active bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg"
                            : "text-gray-700 hover:bg-gray-100 hover:text-indigo-600 hover:shadow-md hover:scale-105"
                        }`
                      }
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className={`nav-icon-wrapper ${open ? '' : 'justify-center'}`}>
                        <item.icon className={`h-5 w-5 shrink-0 transition-all duration-300 ${!open ? 'mx-auto' : ''}`} />
                      </div>
                      {open && (
                        <span className="font-semibold text-sm nav-menu-text">
                          {item.title}
                        </span>
                      )}
                      {!open && (
                        <div className="nav-tooltip">
                          {item.title}
                        </div>
                      )}
                      <div className="nav-menu-indicator"></div>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        {user && (
          <SidebarGroup className="mt-auto px-3">
            <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
              {open ? (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                    <span className="text-white font-semibold text-xs">
                      {user.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {user.email?.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-500">Online</p>
                  </div>
                </div>
              ) : (
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center mx-auto">
                  <span className="text-white font-semibold text-xs">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={handleSignOut}
                    className="nav-logout-btn w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-300 font-semibold group"
                  >
                    <LogOut className="h-5 w-5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                    {open && <span className="font-semibold text-sm">Sign Out</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}