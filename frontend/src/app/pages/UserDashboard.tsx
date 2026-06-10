import { useEffect, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import {
  LayoutDashboard,
  FileText,
  Target,
  BarChart3,
  Download,
  User,
  LogOut,
  Plus,
  Edit,
  MoreVertical,
  Loader,
  TrendingUp,
  Clock,
  Zap,
  ChevronRight,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";
import { useAuth } from "../contexts/AuthContext";
import { resumeAPI, atsAPI } from "../services/api";
import { toast } from "sonner";

const sidebarLinks = [
  { icon: LayoutDashboard, label: "Dashboard",           path: "/dashboard" },
  { icon: FileText,        label: "Create Resume",        path: "/create-resume" },
  { icon: Target,          label: "Paste Job Description",path: "/paste-jd" },
  { icon: BarChart3,       label: "ATS Score",            path: null, handler: "handleATSScoreClick" },
  { icon: FileText,        label: "Templates",            path: "/templates" },
];

interface Resume {
  _id: string;
  resumeTitle: string;
  updatedAt: string;
  jdId?: string | null;
  atsScore?: number | null;
  downloadCount?: number;
}

const getScoreColor = (score: number) =>
  score > 75 ? "text-green-600" : score >= 50 ? "text-yellow-600" : "text-red-600";

const getScoreBg = (score: number) =>
  score > 75 ? "bg-green-600" : score >= 50 ? "bg-yellow-500" : "bg-red-500";

const getScoreBadge = (score: number) =>
  score > 75
    ? { label: "Excellent", cls: "bg-green-100 text-green-700" }
    : score >= 50
    ? { label: "Good",      cls: "bg-yellow-100 text-yellow-700" }
    : { label: "Needs Work", cls: "bg-red-100 text-red-700" };

const formatDate = (date: Date): string => {
  const now  = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

export default function UserDashboard() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, logout, isAuthenticated, isLoading: authLoading } = useAuth();

  const [resumes,    setResumes]    = useState<Resume[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [scoringIds, setScoringIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    totalResumes: 0,
    avgAtsScore:  0,
    avgSubtitle: "out of 100",
    totalDownloads: 0,
    lastUpdated: "Never",
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/auth");
  }, [isAuthenticated, authLoading, navigate]);

  // Re-fetch whenever the user navigates to this page (location.key changes on
  // every navigation, so coming back from CreateResume always triggers a fresh load)
  useEffect(() => {
    if (isAuthenticated) fetchResumes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, location.key]);

  const fetchResumes = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await resumeAPI.getMyResumes();
      console.log("🔵 Dashboard: Loaded resumes with embedded ATS scores from aggregation");
      
      const list: Resume[] = response?.data?.resumes || [];
      console.log(`✅ Dashboard: Loaded ${list.length} resumes (with ATS scores embedded)`);
      
      setResumes(list);
      computeStats(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      // Session-expired errors are already handled globally (redirect in flight)
      const isAuthError = msg.includes('Session expired') || msg.includes('No authentication token');
      if (isAuthError) {
        console.warn('Dashboard: auth error during fetchResumes — redirect already in flight');
        return;
      }
      console.error("❌ Dashboard: Failed to load resumes:", err);
      toast.error("Failed to load resumes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** DEPRECATED: ATS scores now come from getMyResumes aggregation — this function is no longer needed */
  const fetchAllScores = async (list: Resume[]) => {
    // Aggregation in getMyResumes now returns atsScore on every resume object
    // No extra API calls needed
  };

  const computeStats = (list: Resume[]) => {
    const total   = list.length;
    const hasJdLinkedResumes = list.some((r) => Boolean(r.jdId));
    const validScores = list
      .map(r => r.atsScore)
      .filter((score): score is number => score !== null && score !== undefined);
    const avg = validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : 0;
    const downloads = list.reduce((s, r) => s + (r.downloadCount || 0), 0);
    const latest    = total > 0 && list[0]?.updatedAt
      ? formatDate(new Date(list[0].updatedAt))
      : "Never";

    setStats({
      totalResumes:   total,
      avgAtsScore:    avg,
      avgSubtitle:    hasJdLinkedResumes ? "out of 100" : "No JD-linked resumes",
      totalDownloads: downloads,
      lastUpdated:    latest,
    });
  };

  /** Re-score a single resume manually */
  const handleRefreshScore = async (resume: Resume) => {
    if (!resume.jdId) {
      toast.error("JD Required. Add Job Description first.");
      return;
    }

    setScoringIds(prev => new Set(prev).add(resume._id));
    try {
      const result = await atsAPI.calculateScore(resume._id);
      const score = typeof result?.totalScore === "number" ? result.totalScore : undefined;
      setResumes(prev => {
        const updated = prev.map(r => r._id === resume._id ? { ...r, atsScore: score } : r);
        computeStats(updated);
        return updated;
      });
      toast.success(typeof score === "number" ? `Score updated: ${score}/100` : "Score unavailable");
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const isAuthError = msg.includes('Session expired') || msg.includes('No authentication token');
      if (!isAuthError) toast.error("Failed to refresh score");
    } finally {
      setScoringIds(prev => { const s = new Set(prev); s.delete(resume._id); return s; });
    }
  };

  const handleDelete = async (resumeId: string) => {
    try {
      await resumeAPI.deleteResume(resumeId);
      toast.success("Resume deleted");
      const updated = resumes.filter(r => r._id !== resumeId);
      setResumes(updated);
      computeStats(updated);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const isAuthError = msg.includes('Session expired') || msg.includes('No authentication token');
      if (!isAuthError) toast.error("Failed to delete resume");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/auth");
    toast.success("Logged out");
  };

  /**
   * Navigate to ATS Score page with proper validation and logging
   * @param resume - The Resume object containing _id to validate
   */
  const handleScore = useCallback((resume: Resume | null | undefined) => {
    // Step 1: Validate resume object exists
    if (!resume) {
      console.error('❌ [handleScore] Resume object is null or undefined');
      toast.error('Resume data is missing. Please refresh.');
      return;
    }

    console.log('🔍 Resume object:', resume);
    console.log(`   Type: ${typeof resume}`);
    console.log(`   Keys: ${Object.keys(resume).join(', ')}`);

    // Step 2: Validate resume._id exists
    if (!resume._id) {
      console.error('❌ [handleScore] resume._id is undefined or null');
      console.error('   Resume object:', resume);
      toast.error('Resume ID is missing. Cannot navigate to score.');
      return;
    }

    console.log(`🆔 resume._id before trim: "${resume._id}"`);
    console.log(`   Type: ${typeof resume._id}`);
    console.log(`   Length: ${String(resume._id).length}`);

    // Step 3: Convert to string and trim
    const resumeIdString = String(resume._id).trim();
    console.log(`✂️  resume._id after trim: "${resumeIdString}"`);

    // Step 4: Check if empty after trim
    if (!resumeIdString) {
      console.error('❌ [handleScore] resume._id is empty after trim');
      toast.error('Resume ID is empty. Cannot navigate to score.');
      return;
    }

    // Step 5: Validate ObjectId format (24 hexadecimal characters)
    const isValidObjectId = /^[0-9a-f]{24}$/i.test(resumeIdString);
    console.log(`   Is valid MongoDB ObjectId (24 hex): ${isValidObjectId}`);

    if (!isValidObjectId) {
      console.error(`❌ [handleScore] Invalid resume ID format: "${resumeIdString}"`);
      console.error(`   Expected: 24 hexadecimal characters`);
      console.error(`   Got: ${resumeIdString.length} characters`);
      toast.error('Invalid resume ID format. Please refresh.');
      return;
    }

    // Step 6: Construct URL string explicitly
    const targetUrl = `/ats-score?id=${resumeIdString}`;
    console.log(`✅ [handleScore] URL construction successful`);
    console.log(`🌐 Navigating to: ${targetUrl}`);
    console.log(`   Resume title: "${resume.resumeTitle}"`);
    console.log(`   Updated at: ${resume.updatedAt}`);
    console.log(`   Current time: ${new Date().toISOString()}`);

    // Step 7: Navigate using React Router v6
    console.log(`🔗 [handleScore] Calling navigate() now...`);
    navigate(targetUrl);
    console.log(`✅ [handleScore] navigate() completed`);
  }, [navigate]);

  /**
   * Handle Downloads sidebar click - guides user to select a resume to download
   */
  const handleDownloadClick = useCallback(() => {
    if (resumes.length === 0) {
      toast.error('No resumes found. Please create one first.');
      navigate('/create-resume');
      return;
    }
    if (resumes.length === 1) {
      navigate(`/download?id=${resumes[0]._id}`);
      return;
    }
    toast.info('Select a resume below and click the PDF button to download it');
  }, [resumes, navigate]);

  /**
   * Handle ATS Score sidebar click - navigates directly to most recent resume's score
   */
  const handleATSScoreClick = useCallback(() => {
    if (resumes.length === 0) {
      toast.error('No resumes found. Please create one first.');
      navigate('/create-resume');
      return;
    }
    // Navigate directly to the most recent resume's ATS score
    const mostRecent = resumes[0];
    navigate(`/ats-score?id=${mostRecent._id}`);
  }, [resumes, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 font-['Inter']">
      <div className="flex">

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen sticky top-0 flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">B2World</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="p-4 space-y-1 flex-1">
            {sidebarLinks.map(link => {
              const Icon     = link.icon;
              const isActive = link.path && location.pathname === link.path;
              
              // Determine which handler to use
              const handleClick = link.handler === 'handleATSScoreClick'
                ? handleATSScoreClick
                : link.handler === 'handleDownloadClick'
                ? handleDownloadClick
                : undefined;
              
              const navItem = (
                <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                } ${!link.path && handleClick ? 'cursor-pointer' : ''}`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{link.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
                </div>
              );

              // If link has a path, use React Router Link
              if (link.path) {
                return (
                  <Link key={link.label} to={link.path}>
                    {navItem}
                  </Link>
                );
              }
              
              // Otherwise use a button with handler
              return (
                <button
                  key={link.label}
                  onClick={handleClick}
                  className="w-full text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg"
                  title="Select a resume from your list to score it"
                >
                  {navItem}
                </button>
              );
            })}
          </nav>

          {/* User footer */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{user?.name || "User"}</div>
                <div className="text-xs text-gray-500 truncate">{user?.email}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout} title="Logout">
                <LogOut className="w-4 h-4 text-gray-400" />
              </Button>
            </div>
          </div>
        </aside>

        {/* ── Main Content ─────────────────────────────────────────────────── */}
        <main className="flex-1 p-8 min-h-screen">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Resumes</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage and optimize your resumes for better ATS scores
              </p>
            </div>
            <Link to="/create-resume">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Create New Resume
              </Button>
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="border border-gray-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Resumes</span>
                  <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.totalResumes}</div>
                <p className="text-xs text-gray-400 mt-1">
                  {stats.totalResumes === 1 ? "1 resume" : `${stats.totalResumes} resumes`}
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg. ATS Score</span>
                  <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  </div>
                </div>
                <div className={`text-3xl font-bold ${getScoreColor(stats.avgAtsScore)}`}>
                  {stats.avgAtsScore}
                </div>
                <p className="text-xs text-gray-400 mt-1">{stats.avgSubtitle}</p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Downloads</span>
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Download className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-gray-900">{stats.totalDownloads}</div>
                <p className="text-xs text-gray-400 mt-1">total downloads</p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last Updated</span>
                  <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-purple-600" />
                  </div>
                </div>
                <div className="text-lg font-bold text-gray-900">{stats.lastUpdated}</div>
                <p className="text-xs text-gray-400 mt-1">most recent edit</p>
              </CardContent>
            </Card>
          </div>

          {/* Resume Cards */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader className="w-10 h-10 animate-spin text-indigo-600" />
              <p className="text-sm text-gray-500">Loading your resumes…</p>
            </div>
          ) : resumes.length === 0 ? (
            <Card className="border border-dashed border-gray-300 bg-white">
              <CardContent className="p-16 text-center">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No resumes yet</h3>
                <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
                  Create your first ATS-optimized resume to get started on your job search.
                </p>
                <Link to="/create-resume">
                  <Button className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Resume
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {resumes.map(resume => {
                console.log('🔍 Rendering resume card:', {
                  resumeTitle: resume.resumeTitle,
                  _id: resume._id,
                  idExists: !!resume._id,
                  atsScore: resume.atsScore,
                  updatedAt: resume.updatedAt
                });
                
                const score    = resume.atsScore;
                const scoring  = scoringIds.has(resume._id);
                const hasJd    = Boolean(resume.jdId);
                const hasScore = hasJd && score !== null && score !== undefined;
                const badge    = hasScore
                  ? getScoreBadge(score)
                  : hasJd
                  ? { label: "Scoring Pending", cls: "bg-gray-100 text-gray-600" }
                  : { label: "JD Required", cls: "bg-orange-100 text-orange-700" };

                return (
                  <Card
                    key={resume._id}
                    className="border border-gray-200 hover:border-indigo-200 hover:shadow-md transition-all bg-white"
                  >
                    <CardContent className="p-5">
                      {/* Card header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate text-base">
                            {resume.resumeTitle || "Untitled Resume"}
                          </h3>
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Updated {formatDate(new Date(resume.updatedAt))}
                          </p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onSelect={() => {
                              if (!resume._id) {
                                toast.error('Resume ID is missing. Cannot edit.');
                                console.error('❌ Resume edit: missing _id', resume);
                              } else {
                                console.log(`✅ Navigating to edit with resumeId: ${resume._id}`);
                                navigate(`/create-resume?id=${resume._id}`);
                              }
                            }}>
                              <Edit className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            
                            {/* View Score - Navigate to ATS Score page */}
                            <DropdownMenuItem 
                              disabled={!resume._id}
                              onSelect={() => handleScore(resume)}
                            >
                              <BarChart3 className="w-4 h-4 mr-2" /> View Score
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem onSelect={() => {
                              if (!resume._id) {
                                toast.error('Resume ID is missing. Cannot refresh.');
                                console.error('❌ Refresh score: missing _id', resume);
                              } else {
                                handleRefreshScore(resume);
                              }
                            }}>
                              <RefreshCw className="w-4 h-4 mr-2" /> Refresh Score
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem onSelect={() => {
                              if (!resume._id) {
                                toast.error('Resume ID is missing. Cannot download.');
                                console.error('❌ Download: missing _id', resume);
                              } else {
                                console.log(`✅ Navigating to download with resumeId: ${resume._id}`);
                                navigate(`/download?id=${resume._id}`);
                              }
                            }}>
                              <Download className="w-4 h-4 mr-2" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onSelect={() => handleDelete(resume._id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* ATS Score block */}
                      <div className="mb-4 p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500">ATS Score</span>
                          <div className="flex items-center gap-2">
                            {scoring ? (
                              <div className="flex items-center gap-1 text-xs text-indigo-600">
                                <Loader className="w-3 h-3 animate-spin" />
                                Scoring…
                              </div>
                            ) : (
                              <>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                                  {badge.label}
                                </span>
                                {hasScore && (
                                  <span className={`text-base font-bold ${getScoreColor(score)}`}>
                                    {score}/100
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        {hasScore && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-700 ${getScoreBg(score)}`}
                              style={{ width: scoring ? "100%" : `${score}%` }}
                            />
                          </div>
                        )}
                        {!hasJd && (
                          <div className="mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/paste-jd?resumeId=${resume._id}`)}
                              className="h-7 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
                            >
                              Add Job Description
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        <Link to={`/create-resume?id=${resume._id}`} className="col-span-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-8 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                        </Link>

                        {/* Score button - always visible, disabled if no ID */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleScore(resume)}
                          disabled={!resume._id}
                          className={`w-full text-xs h-8 col-span-1 ${
                            resume._id 
                              ? 'border-gray-200 hover:border-indigo-300 hover:text-indigo-600 cursor-pointer' 
                              : 'border-gray-200 text-gray-300 cursor-not-allowed opacity-50'
                          }`}
                          title={resume._id ? "Click to analyze resume ATS score" : "Resume ID not available"}
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          Score
                        </Button>

                        <Link to={`/download?id=${resume._id}`} className="col-span-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs h-8 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            PDF
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Add new resume card */}
              <Link to="/create-resume">
                <Card className="border border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer h-full min-h-[220px] bg-white">
                  <CardContent className="p-5 h-full flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <Plus className="w-6 h-6 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Create New Resume</p>
                      <p className="text-xs text-gray-400 mt-0.5">Start from scratch or use a template</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
