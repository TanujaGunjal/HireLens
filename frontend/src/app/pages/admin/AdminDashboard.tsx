import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  FileText, 
  Database,
  LogOut,
  TrendingUp,
  Download,
  Target
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { adminAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

const sidebarLinks = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Users, label: "User Management", path: "/admin/users" },
  { icon: BarChart3, label: "Resume & ATS Stats", path: "/admin/stats" },
  { icon: Database, label: "Keywords Library", path: "/admin/keywords" },
];

// Helper to format relative time
const formatRelativeTime = (timestamp: string | Date): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
};

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalResumes: 0,
    totalDownloads: 0,
    activeUsers: 0,
    avgATSScore: 0,
    highScore: 0,
  });
  const [chartData, setChartData] = useState({
    monthlyTrend: [],
  });
  const [recentActivityData, setRecentActivityData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response: any = await adminAPI.getStats();
        const statsData = response?.data?.stats || {
          totalUsers: 0,
          totalResumes: 0,
          totalDownloads: 0,
          activeUsers: 0,
          avgATSScore: 0,
          highScore: 0,
        };
        const chartsData = response?.data?.charts || {
          monthlyTrend: [],
        };
        
        setStats(statsData);
        setChartData(chartsData);
      } catch (error) {
        console.error("Failed to load admin stats:", error);
        setStats({
          totalUsers: 0,
          totalResumes: 0,
          totalDownloads: 0,
          activeUsers: 0,
          avgATSScore: 0,
          highScore: 0,
        });
      }

      // Fetch recent activity
      try {
        const activityResponse: any = await adminAPI.getActivity(10);
        const activities = activityResponse?.data?.activities || [];
        const formattedActivities = activities.map((activity: any) => ({
          ...activity,
          time: formatRelativeTime(activity.time)
        }));
        setRecentActivityData(formattedActivities);
      } catch (error) {
        console.error("Failed to load recent activity:", error);
        setRecentActivityData([]);
      }
      
      setIsLoading(false);
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 font-['Inter']">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen sticky top-0">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <FileText className="w-8 h-8 text-indigo-600" />
              <div>
                <span className="text-xl font-bold text-gray-900 block">B2World</span>
                <span className="text-xs text-gray-600">Admin Panel</span>
              </div>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            {sidebarLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <Link key={link.path} to={link.path}>
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{link.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">
                  {user?.name ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase() : 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm truncate">{user?.name || 'Admin'}</div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  navigate('/auth');
                }}
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Overview</h1>
            <p className="text-gray-600">Monitor platform performance and user activity</p>
          </div>

          {/* Metrics Cards */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Total Users</span>
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalUsers.toLocaleString()}</div>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-gray-600">Registered accounts</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Total Resumes</span>
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalResumes.toLocaleString()}</div>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-gray-600">Avg ATS score: {stats.avgATSScore}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Total Downloads</span>
                  <Download className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalDownloads.toLocaleString()}</div>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-gray-600">PDF exports</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">High Score (80+)</span>
                  <Target className="w-5 h-5 text-yellow-600" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.highScore.toLocaleString()}</div>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-gray-600">
                    {stats.totalResumes > 0 ? `${Math.round((stats.highScore / stats.totalResumes) * 100)}%` : "0%"} of total
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            {/* Resume Creation Trend */}
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle>Resume Creation Trend (Monthly)</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.monthlyTrend && chartData.monthlyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip />
                      <Line type="monotone" dataKey="resumes" stroke="#4f46e5" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No data available yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Users */}
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle>Active Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-600">Active Users</span>
                      <span className="text-lg font-bold text-indigo-600">{stats.activeUsers}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-indigo-600 h-2 rounded-full" 
                        style={{ width: `${stats.totalUsers > 0 ? (stats.activeUsers / stats.totalUsers) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {stats.totalUsers > 0 ? `${Math.round((stats.activeUsers / stats.totalUsers) * 100)}%` : "0%"} of {stats.totalUsers} users
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivityData.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-indigo-600 font-semibold text-sm">
                          {activity.user.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{activity.user}</div>
                        <div className="text-sm text-gray-600">{activity.action}</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">{activity.time}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
