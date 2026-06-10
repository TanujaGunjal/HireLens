import { Link, useLocation, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  FileText,
  Database,
  LogOut,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { adminAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";

const sidebarLinks = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: Users, label: "User Management", path: "/admin/users" },
  { icon: BarChart3, label: "Resume & ATS Stats", path: "/admin/stats" },
  { icon: Database, label: "Keywords Library", path: "/admin/keywords" },
];

export default function KeywordsLibrary() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const [keywordRoles, setKeywordRoles] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [showAddRoleDialog, setShowAddRoleDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchKeywords();
  }, []);

  const fetchKeywords = async () => {
    try {
      const keywordData: any = await adminAPI.getKeywords();
      const libs = keywordData?.data?.libraries || keywordData?.libraries || [];
      const mapped =
        Array.isArray(libs) && libs.length > 0
          ? libs.map((lib: any) => {
              let keywords: string[] = [];
              if (lib.keywords && Array.isArray(lib.keywords)) {
                keywords = lib.keywords
                  .map((k: any) => (typeof k === "string" ? k : k.term || ""))
                  .filter((k: string) => k);
              }
              if (keywords.length === 0) {
                keywords = [
                  ...(lib.requiredKeywords || []),
                  ...(lib.preferredKeywords || []),
                  ...(lib.tools || []),
                ];
              }
              return { role: lib.role, keywords };
            })
          : [];
      setKeywordRoles(mapped);
      if (mapped.length > 0) {
        setSelectedRole((prev) =>
          mapped.find((r: any) => r.role === prev) ? prev : mapped[0].role
        );
      }
    } catch (error) {
      console.error("Failed to load keyword libraries:", error);
      toast.error("Failed to load keywords");
    }
  };

  const handleAddRole = async () => {
    if (!newRoleName.trim()) {
      toast.error("Please enter a role name");
      return;
    }
    setIsLoading(true);
    try {
      await adminAPI.addRoleKeywordLibrary(newRoleName.trim());
      toast.success("Role added successfully");
      setNewRoleName("");
      setShowAddRoleDialog(false);
      await fetchKeywords();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add role");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRole = async (role: string) => {
    if (!window.confirm(`Delete the "${role}" role and all its keywords?`)) return;
    setIsLoading(true);
    try {
      await adminAPI.deleteRoleKeywordLibrary(role);
      toast.success("Role deleted successfully");
      const remaining = keywordRoles.filter((r) => r.role !== role);
      setSelectedRole(remaining[0]?.role || "");
      await fetchKeywords();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete role");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) {
      toast.error("Please enter a keyword");
      return;
    }
    setIsLoading(true);
    try {
      await adminAPI.addKeywordToRole(selectedRole, newKeyword.trim());
      toast.success("Keyword added");
      setNewKeyword("");
      await fetchKeywords();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add keyword");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveKeyword = async (keyword: string) => {
    setIsLoading(true);
    try {
      await adminAPI.removeKeywordFromRole(selectedRole, keyword);
      toast.success("Keyword removed");
      await fetchKeywords();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to remove keyword");
    } finally {
      setIsLoading(false);
    }
  };

  const currentRoleData = useMemo(
    () => keywordRoles.find((r) => r.role === selectedRole),
    [keywordRoles, selectedRole]
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
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Keywords Library</h1>
              <p className="text-gray-600">Manage role-specific keywords for ATS optimization</p>
            </div>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => setShowAddRoleDialog(true)}
              disabled={isLoading}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Role
            </Button>
          </div>

          {/* Add Role Dialog */}
          {showAddRoleDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <Card className="w-full max-w-md">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900">Add New Role</h2>
                    <button
                      onClick={() => setShowAddRoleDialog(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="block mb-2">Role Name</Label>
                      <Input
                        placeholder="e.g., React Developer, Product Manager"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddRole(); }}
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowAddRoleDialog(false)}
                        className="flex-1"
                        disabled={isLoading}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                        onClick={handleAddRole}
                        disabled={isLoading}
                      >
                        {isLoading ? "Creating..." : "Create Role"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Stats */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 mb-1">Total Roles</div>
                <div className="text-3xl font-bold text-gray-900">{keywordRoles.length}</div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <div className="text-sm text-gray-600 mb-1">Total Keywords</div>
                <div className="text-3xl font-bold text-indigo-600">
                  {keywordRoles.reduce((sum, r) => sum + r.keywords.length, 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left — Roles List */}
            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <h2 className="font-semibold text-gray-900 mb-4">Job Roles</h2>
                <div className="space-y-2">
                  {keywordRoles.map((roleData) => (
                    <button
                      key={roleData.role}
                      onClick={() => setSelectedRole(roleData.role)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedRole === roleData.role
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                          : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{roleData.role}</span>
                        <Badge variant="secondary" className="text-xs">
                          {roleData.keywords.length}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setShowAddRoleDialog(true)}
                  disabled={isLoading}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Role
                </Button>
              </CardContent>
            </Card>

            {/* Right — Keywords Management */}
            <div className="lg:col-span-2 space-y-6">
              {selectedRole ? (
                <>
                  {/* Role Header */}
                  <Card className="border border-gray-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedRole}</h2>
                          <p className="text-sm text-gray-600">
                            {currentRoleData?.keywords.length ?? 0} keywords defined
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteRole(selectedRole)}
                          disabled={isLoading}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Role
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Add Keyword */}
                  <Card className="border border-gray-200">
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-gray-900 mb-4">Add Keyword</h3>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <Input
                            placeholder="e.g., React, Leadership, Python"
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleAddKeyword(); }}
                            disabled={isLoading}
                          />
                        </div>
                        <Button
                          className="bg-indigo-600 hover:bg-indigo-700"
                          onClick={handleAddKeyword}
                          disabled={isLoading}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Keywords List */}
                  <Card className="border border-gray-200">
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-gray-900 mb-4">Current Keywords</h3>
                      {currentRoleData?.keywords.length === 0 ? (
                        <p className="text-gray-500 text-sm">No keywords yet. Add the first one above.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {currentRoleData?.keywords.map((keyword: string, index: number) => (
                            <Badge
                              key={index}
                              className="px-3 py-2 text-sm bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                            >
                              <span>{keyword}</span>
                              <button
                                className="ml-2 hover:text-indigo-900 font-bold"
                                onClick={() => handleRemoveKeyword(keyword)}
                                disabled={isLoading}
                                title="Remove keyword"
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="border border-gray-200">
                  <CardContent className="p-12 text-center text-gray-500">
                    Select a role from the left to manage its keywords.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
