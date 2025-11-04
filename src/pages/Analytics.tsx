import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Download, Eye, Upload as UploadIcon, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AnalyticsData {
  totalViews: number;
  totalDownloads: number;
  totalUploads: number;
  topAssets: Array<{ name: string; count: number; asset_id: string }>;
  trend: number;
  dailyStats: Array<{ date: string; views: number; downloads: number; uploads: number }>;
}

const Analytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalViews: 0,
    totalDownloads: 0,
    totalUploads: 0,
    topAssets: [],
    trend: 0,
    dailyStats: [],
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

        setAnalytics({
          totalViews: views.count || 0,
          totalDownloads: downloads.count || 0,
          totalUploads: uploads.count || 0,
          topAssets: topAssetsData,
          trend,
          dailyStats,
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