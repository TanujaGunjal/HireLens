import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  FileText,
  Database,
  LogOut,
  Search,
  Filter,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { adminAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

const sidebarLinks = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Users, label: "User Management", path: "/admin/users" },
  { icon: BarChart3, label: "Resume & ATS Stats", path: "/admin/stats" },
  { icon: Database, label: "Keywords Library", path: "/admin/keywords" },
];

export default function UserManagement() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [filterRole, setFilterRole] = useState("all");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [totalResumes, setTotalResumes] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const usersRes: any = await adminAPI.getUsers({ search: search || undefined, limit: 100 });
        const statsRes: any = await adminAPI.getStats();
        setUsers(usersRes?.data?.users || []);
        setTotalResumes(statsRes?.data?.stats?.totalResumes || 0);
      } catch (error) {
        console.error("Failed to load admin users:", error);
        setUsers([]);
      }
    };
    load();
  }, [search]);

  const filteredUsers = useMemo(
    () => users.filter((u: any) => filterRole === "all" || String(u.role || "USER").toLowerCase() === filterRole),
    [users, filterRole]
  );

  const adminInitials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase()
    : "A";

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
                <span className="text-white font-semibold">{adminInitials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm truncate">{user?.name || "Admin"}</div>
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
            <p className="text-gray-600">View and manage all registered users</p>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 mb-1">Total Users</div>
                <div className="text-3xl font-bold text-gray-900">{users.length}</div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 mb-1">Active Users</div>
                <div className="text-3xl font-bold text-green-600">
                  {users.filter((u: any) => u.isActive !== false).length}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 mb-1">Admins</div>
                <div className="text-3xl font-bold text-indigo-600">
                  {users.filter((u: any) => String(u.role || "").toUpperCase() === "ADMIN").length}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 mb-1">Avg. Resumes / User</div>
                <div className="text-3xl font-bold text-gray-900">
                  {users.length > 0 ? (totalResumes / users.length).toFixed(1) : "0.0"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card className="border border-gray-200 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-gray-600" />
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card className="border border-gray-200">
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Resumes</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u: any) => (
                    <TableRow key={u._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 font-semibold text-sm">
                              {(u.name || "U").split(" ").map((n: string) => n[0]).join("")}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">{u.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={String(u.role || "").toUpperCase() === "ADMIN" ? "default" : "secondary"}
                          className={String(u.role || "").toUpperCase() === "ADMIN" ? "bg-indigo-600" : ""}
                        >
                          {String(u.role || "USER").toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-900 font-semibold">{u.resumes || 0}</TableCell>
                      <TableCell className="text-gray-600">
                        {u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.isActive !== false ? "default" : "secondary"}
                          className={u.isActive !== false ? "bg-green-600" : "bg-gray-500"}
                        >
                          {u.isActive !== false ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
