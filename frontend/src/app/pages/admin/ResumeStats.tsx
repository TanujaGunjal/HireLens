import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  FileText,
  Database,
  LogOut,
  TrendingUp
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { adminAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

const sidebarLinks = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Users, label: "User Management", path: "/admin/users" },
  { icon: BarChart3, label: "Resume & ATS Stats", path: "/admin/stats" },
  { icon: Database, label: "Keywords Library", path: "/admin/keywords" },
];

const COLORS = ['#4f46e5', '#10b981', '#f59e0b'];

export default function ResumeStats() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [stats, setStats] = useState({ 
    totalResumes: 0, 
    totalDownloads: 0,
    avgATSScore: 0,
    highScore: 0
  });
  const [chartData, setChartData] = useState({
    monthlyTrend: [],
    atsScoreDistribution: [],
    templateUsage: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data: any = await adminAPI.getStats();
        const statsData = data?.data?.stats || { 
          totalResumes: 0, 
          totalDownloads: 0,
          avgATSScore: 0,
          highScore: 0
        };
        const chartsData = data?.data?.charts || {
          monthlyTrend: [],
          atsScoreDistribution: [],
          templateUsage: []
        };
        
        setStats(statsData);
        setChartData(chartsData);
      } catch (error) {
        console.error("Failed to load stats:", error);
      } finally {
        setIsLoading(false);
      }
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Resume & ATS Statistics</h1>
            <p className="text-gray-600">Analyze resume creation trends and ATS performance</p>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 mb-1">Total Resumes</div>
                <div className="text-3xl font-bold text-gray-900 mb-2">{stats.totalResumes.toLocaleString()}</div>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-gray-600">All-time resumes created</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 mb-1">Avg. ATS Score</div>
                <div className="text-3xl font-bold text-green-600 mb-2">{stats.avgATSScore}</div>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-gray-600">Across all resumes</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 mb-1">High Score (80+)</div>
                <div className="text-3xl font-bold text-indigo-600 mb-2">
                  {stats.highScore.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-gray-600">
                    {stats.totalResumes > 0 ? `${Math.round((stats.highScore / stats.totalResumes) * 100)}%` : "0%"} of total
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 mb-1">Downloads</div>
                <div className="text-3xl font-bold text-gray-900 mb-2">{stats.totalDownloads.toLocaleString()}</div>
                <div className="flex items-center gap-1 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-gray-600">PDF exports</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1 */}
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
                      <Line type="monotone" dataKey="resumes" stroke="#4f46e5" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No data available yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Template Usage */}
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle>Template Usage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.templateUsage && chartData.templateUsage.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={chartData.templateUsage}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.templateUsage.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No template data available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ATS Score Distribution */}
          <Card className="border border-gray-200 mb-8">
            <CardHeader>
              <CardTitle>ATS Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.atsScoreDistribution && chartData.atsScoreDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData.atsScoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="range" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4f46e5">
                      {chartData.atsScoreDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-gray-500">
                  No score distribution data available yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Score Breakdown Stats */}
          <div className="grid md:grid-cols-5 gap-6">
            {chartData.atsScoreDistribution && chartData.atsScoreDistribution.length > 0 ? (
              chartData.atsScoreDistribution.map((item) => {
                const total = chartData.atsScoreDistribution.reduce((sum, d) => sum + d.count, 0);
                return (
                  <Card key={item.range} className="border border-gray-200">
                    <CardContent className="p-6">
                      <div className="text-sm text-gray-600 mb-2">Score {item.range}</div>
                      <div className="text-3xl font-bold mb-2" style={{ color: item.color }}>
                        {item.count}
                      </div>
                      <div className="text-sm text-gray-600">
                        {total > 0 ? ((item.count / total) * 100).toFixed(1) : "0"}%
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-5 text-center text-gray-500 py-8">
                No score distribution data available yet
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
