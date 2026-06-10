import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  FileText,
  Database,
  LogOut,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { adminAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

const sidebarLinks = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Users, label: "User Management", path: "/admin/users" },
  { icon: BarChart3, label: "Resume & ATS Stats", path: "/admin/stats" },
  { icon: Database, label: "Keywords Library", path: "/admin/keywords" },
];

export default function TemplateManagement() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data: any = await adminAPI.getTemplates();
        const list = data?.templates || [];
        if (Array.isArray(list) && list.length > 0) {
          setTemplates(
            list.map((t: any) => ({
              id: t._id,
              name: t.name || "Template",
              description: t.description || "",
              active: t.isActive !== false,
              lastUpdated: t.updatedAt
                ? new Date(t.updatedAt).toISOString().slice(0, 10)
                : "—",
            }))
          );
        }
      } catch (error) {
        console.error("Failed to load templates:", error);
      }
    };
    load();
  }, []);

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
                  navigate("/auth");
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
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Template Management</h1>
            <p className="text-gray-600">Overview of available resume templates</p>
          </div>

          {/* Summary Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 mb-1">Total Templates</div>
                <div className="text-3xl font-bold text-gray-900">{templates.length}</div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 mb-1">Active Templates</div>
                <div className="text-3xl font-bold text-green-600">
                  {templates.filter((t) => t.active).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Templates List — read-only */}
          <div className="space-y-4">
            {templates.length === 0 ? (
              <Card className="border border-gray-200">
                <CardContent className="p-12 text-center text-gray-500">
                  No templates found in the database.
                </CardContent>
              </Card>
            ) : (
              templates.map((template) => (
                <Card key={template.id} className="border border-gray-200">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-6">
                      {/* Visual preview thumbnail */}
                      <div className="w-32 h-40 bg-gray-100 rounded-lg border-2 border-gray-200 flex-shrink-0">
                        <div className="p-3 bg-white h-full rounded-lg">
                          <div className="space-y-2">
                            <div className="h-2 bg-gray-800 w-16 mx-auto rounded" />
                            <div className="h-1 bg-gray-400 w-20 mx-auto rounded" />
                            <div className="border-t border-gray-300 my-2" />
                            <div className="space-y-1">
                              <div className="h-1 bg-gray-300 w-full rounded" />
                              <div className="h-1 bg-gray-200 w-full rounded" />
                              <div className="h-1 bg-gray-200 w-3/4 rounded" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Template Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">{template.name}</h3>
                          <Badge
                            variant={template.active ? "default" : "secondary"}
                            className={template.active ? "bg-green-600" : "bg-gray-500"}
                          >
                            {template.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        {template.description && (
                          <p className="text-gray-600 mb-3">{template.description}</p>
                        )}
                        <div className="text-sm text-gray-500">
                          Last updated: {template.lastUpdated}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
