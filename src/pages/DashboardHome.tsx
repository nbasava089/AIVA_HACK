import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Image, Upload, Users } from "lucide-react";

const DashboardHome = () => {
  const [stats, setStats] = useState({
    totalAssets: 0,
    totalFolders: 0,
    recentUploads: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (profile) {
        const [assets, folders, recentAssets] = await Promise.all([
          supabase
            .from("assets")
            .select("id", { count: "exact" })
            .eq("tenant_id", profile.tenant_id),
          supabase
            .from("folders")
            .select("id", { count: "exact" })
            .eq("tenant_id", profile.tenant_id),
          supabase
            .from("assets")
            .select("id", { count: "exact" })
            .eq("tenant_id", profile.tenant_id)
            .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        ]);

        setStats({
          totalAssets: assets.count || 0,
          totalFolders: folders.count || 0,
          recentUploads: recentAssets.count || 0,
        });
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-10 jato-fade-in-up">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl p-8 md:p-12 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 shadow-2xl">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        <div className="relative z-10">
          {/* <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300">
              <span className="text-white font-bold text-lg">AI</span>
            </div>
            <div className="h-1 w-16 bg-white/30 rounded-full"></div>
          </div> */}
          <h1 className="text-4xl md:text-6xl font-black mb-4 text-white leading-tight">
            Welcome to <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">AIVA</span>
          </h1>
          <p className="text-xl text-white/90 max-w-2xl leading-relaxed mb-6">
            Your intelligent Digital Asset Management platform powered by AI
          </p>
          <div className="mt-8 flex items-center gap-4 flex-wrap">
            <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-semibold hover:bg-white/30 transition-colors duration-300">
              ✨ AI-Powered
            </div>
            {/* <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-semibold hover:bg-white/30 transition-colors duration-300">
              🚀 Smart Organization
            </div>
            <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-semibold hover:bg-white/30 transition-colors duration-300">
              📁 Folder Management
            </div> */}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-8 md:grid-cols-3">
        <Card className="dashboard-card-enhanced relative overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500 group hover:-translate-y-2">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 pt-6">
            <CardTitle className="text-sm font-bold text-gray-600 uppercase tracking-wider">
              Total Assets
            </CardTitle>
            <div className="card-icon h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <Image className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="card-number text-4xl font-black text-gray-800 mb-2 group-hover:text-blue-600 transition-colors duration-300">
              {stats.totalAssets.toLocaleString()}
            </div>
            <p className="text-sm text-gray-500 font-medium">Digital files managed</p>
            <div className="mt-4 flex items-center text-xs text-green-600 font-semibold">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
              Active
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card-enhanced relative overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500 group hover:-translate-y-2">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-amber-600"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 pt-6">
            <CardTitle className="text-sm font-bold text-gray-600 uppercase tracking-wider">
              Total Folders
            </CardTitle>
            <div className="card-icon h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <FolderOpen className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="card-number text-4xl font-black text-gray-800 mb-2 group-hover:text-orange-600 transition-colors duration-300">
              {stats.totalFolders.toLocaleString()}
            </div>
            <p className="text-sm text-gray-500 font-medium">Organized collections</p>
            <div className="mt-4 flex items-center text-xs text-orange-600 font-semibold">
              <div className="w-2 h-2 rounded-full bg-orange-500 mr-2 animate-pulse"></div>
              Organized
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card-enhanced relative overflow-hidden border-0 bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all duration-500 group hover:-translate-y-2">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-green-500/5 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-600"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 pt-6">
            <CardTitle className="text-sm font-bold text-gray-600 uppercase tracking-wider">
              Recent Uploads
            </CardTitle>
            <div className="card-icon h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
              <Upload className="h-6 w-6 text-white" />
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="card-number text-4xl font-black text-gray-800 mb-2 group-hover:text-emerald-600 transition-colors duration-300">
              {stats.recentUploads.toLocaleString()}
            </div>
            <p className="text-sm text-gray-500 font-medium">In the last 7 days</p>
            <div className="mt-4 flex items-center text-xs text-emerald-600 font-semibold">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></div>
              Recent
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardHome;