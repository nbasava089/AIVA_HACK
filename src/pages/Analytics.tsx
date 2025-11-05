import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Download, Eye, Upload as UploadIcon, TrendingUp, PieChart } from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart as RechartsPieChart,
  Cell,
  Pie,
  Legend
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AnalyticsData {
  totalViews: number;
  totalDownloads: number;
  totalUploads: number;
  topAssets: Array<{ name: string; count: number; asset_id: string }>;
  trend: number;
  dailyStats: Array<{ date: string; views: number; downloads: number; uploads: number }>;
  fileTypeDistribution: Array<{ name: string; value: number; color: string }>;
  folderDistribution: Array<{ name: string; value: number; color: string }>;
  activityDistribution: Array<{ name: string; value: number; color: string }>;
}

const Analytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalViews: 0,
    totalDownloads: 0,
    totalUploads: 0,
    topAssets: [],
    trend: 0,
    dailyStats: [],
    fileTypeDistribution: [],
    folderDistribution: [],
    activityDistribution: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (profile) {
        // Get current period stats
        const [views, downloads, uploads, allEvents] = await Promise.all([
          supabase
            .from("analytics_events")
            .select("id", { count: "exact" })
            .eq("tenant_id", profile.tenant_id)
            .eq("event_type", "view"),
          supabase
            .from("analytics_events")
            .select("id", { count: "exact" })
            .eq("tenant_id", profile.tenant_id)
            .eq("event_type", "download"),
          supabase
            .from("analytics_events")
            .select("id", { count: "exact" })
            .eq("tenant_id", profile.tenant_id)
            .eq("event_type", "upload"),
          supabase
            .from("analytics_events")
            .select("*")
            .eq("tenant_id", profile.tenant_id)
            .order("created_at", { ascending: false }),
        ]);

        // Calculate trend (last 7 days vs previous 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const recentEvents = allEvents.data?.filter(e => 
          new Date(e.created_at) > sevenDaysAgo
        ).length || 0;

        const previousEvents = allEvents.data?.filter(e => {
          const date = new Date(e.created_at);
          return date > fourteenDaysAgo && date <= sevenDaysAgo;
        }).length || 0;

        const trend = previousEvents > 0 
          ? Math.round(((recentEvents - previousEvents) / previousEvents) * 100)
          : 0;

        // Get top assets
        const assetCounts: Record<string, { count: number; name: string }> = {};
        for (const event of allEvents.data || []) {
          if (event.asset_id && (event.event_type === 'view' || event.event_type === 'download')) {
            if (!assetCounts[event.asset_id]) {
              assetCounts[event.asset_id] = { count: 0, name: '' };
            }
            assetCounts[event.asset_id].count++;
          }
        }

        // Fetch asset names for top assets
        const topAssetIds = Object.entries(assetCounts)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 5)
          .map(([id]) => id);

        let topAssetsData: Array<{ name: string; count: number; asset_id: string }> = [];
        if (topAssetIds.length > 0) {
          const { data: assets } = await supabase
            .from("assets")
            .select("id, name")
            .in("id", topAssetIds);

          topAssetsData = topAssetIds.map(id => {
            const asset = assets?.find(a => a.id === id);
            return {
              asset_id: id,
              name: asset?.name || 'Unknown Asset',
              count: assetCounts[id].count,
            };
          });
        }

        // Calculate daily stats for last 7 days
        const dailyStats = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);

          const dayEvents = allEvents.data?.filter(e => {
            const eventDate = new Date(e.created_at);
            return eventDate >= date && eventDate < nextDate;
          }) || [];

          dailyStats.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            views: dayEvents.filter(e => e.event_type === 'view').length,
            downloads: dayEvents.filter(e => e.event_type === 'download').length,
            uploads: dayEvents.filter(e => e.event_type === 'upload').length,
          });
        }

        // Prepare pie chart data
        
        // 1. Activity Distribution
        const activityDistribution = [
          { name: 'Views', value: views.count || 0, color: '#3B82F6' },
          { name: 'Downloads', value: downloads.count || 0, color: '#10B981' },
          { name: 'Uploads', value: uploads.count || 0, color: '#F59E0B' },
        ].filter(item => item.value > 0);

        // 2. File Type Distribution (get from assets)
        const { data: allAssets } = await supabase
          .from("assets")
          .select(`
            file_type,
            folders!inner(tenant_id)
          `)
          .eq("folders.tenant_id", profile.tenant_id);

        const fileTypeCounts: Record<string, number> = {};
        for (const asset of allAssets || []) {
          const type = asset.file_type?.split('/')[0] || 'other';
          fileTypeCounts[type] = (fileTypeCounts[type] || 0) + 1;
        }

        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
        const fileTypeDistribution = Object.entries(fileTypeCounts)
          .map(([type, count], index) => ({
            name: type.charAt(0).toUpperCase() + type.slice(1),
            value: count,
            color: colors[index % colors.length],
          }))
          .filter(item => item.value > 0);

        // 3. Folder Distribution (get assets per folder)
        const { data: allFolders } = await supabase
          .from("folders")
          .select("id, name")
          .eq("tenant_id", profile.tenant_id);

        const { data: assetsByFolder } = await supabase
          .from("assets")
          .select("folder_id")
          .not("folder_id", "is", null);

        const folderCounts: Record<string, { name: string; count: number }> = {};
        
        // Initialize all folders
        for (const folder of allFolders || []) {
          folderCounts[folder.id] = { name: folder.name, count: 0 };
        }
        
        // Count assets per folder
        for (const asset of assetsByFolder || []) {
          if (asset.folder_id && folderCounts[asset.folder_id]) {
            folderCounts[asset.folder_id].count++;
          }
        }

        const folderDistribution = Object.entries(folderCounts)
          .map(([id, data], index) => ({
            name: data.name,
            value: data.count,
            color: colors[index % colors.length],
          }))
          .filter(item => item.value > 0)
          .sort((a, b) => b.value - a.value)
          .slice(0, 8); // Limit to top 8 folders

        setAnalytics({
          totalViews: views.count || 0,
          totalDownloads: downloads.count || 0,
          totalUploads: uploads.count || 0,
          topAssets: topAssetsData,
          trend,
          dailyStats,
          fileTypeDistribution,
          folderDistribution,
          activityDistribution,
        });
      }
      setLoading(false);
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Analytics Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalViews}</div>
            <p className="text-xs text-muted-foreground mt-1">Asset views</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalDownloads}</div>
            <p className="text-xs text-muted-foreground mt-1">Asset downloads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Uploads</CardTitle>
            <UploadIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalUploads}</div>
            <p className="text-xs text-muted-foreground mt-1">New assets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">7-Day Trend</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${analytics.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {analytics.trend >= 0 ? '+' : ''}{analytics.trend}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">vs previous week</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.dailyStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No activity data available yet. Start viewing, downloading, or uploading assets to see analytics.
            </div>
          ) : (
            <ChartContainer
              config={{
                views: { label: "Views", color: "hsl(var(--primary))" },
                downloads: { label: "Downloads", color: "hsl(var(--chart-2))" },
                uploads: { label: "Uploads", color: "hsl(var(--chart-3))" },
              }}
              className="h-[300px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="views" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="downloads" stroke="hsl(var(--chart-2))" strokeWidth={2} />
                  <Line type="monotone" dataKey="uploads" stroke="hsl(var(--chart-3))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Pie Charts Row */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Activity Distribution Pie Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity Distribution</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analytics.activityDistribution.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No activity data available yet
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={analytics.activityDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {analytics.activityDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* File Type Distribution Pie Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">File Types</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analytics.fileTypeDistribution.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No files uploaded yet
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={analytics.fileTypeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {analytics.fileTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Folder Distribution Pie Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assets by Folder</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analytics.folderDistribution.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No folders with assets yet
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={analytics.folderDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {analytics.folderDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Assets</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.topAssets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No asset activity yet. Assets will appear here once they are viewed or downloaded.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Name</TableHead>
                  <TableHead className="text-right">Total Activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.topAssets.map((asset, index) => (
                  <TableRow key={asset.asset_id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">#{index + 1}</span>
                        {asset.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{asset.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Analytics;