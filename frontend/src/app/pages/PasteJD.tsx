import { useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  ChevronLeft, FileText, Sparkles, Loader, CheckCircle,
  Target, Zap, BookOpen, Star, ChevronDown,
  X, RotateCcw, ClipboardPaste, AlertCircle, ArrowRight,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { useAuth } from "../contexts/AuthContext";
import { jdAPI, resumeAPI } from "../services/api";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Keyword {
  keyword: string;
  frequency: number;
  category: "skill" | "tool" | "responsibility" | "qualification" | "other";
}

interface Analysis {
  jdId: string;
  role: string;
  experienceLevel: string;
  skills: string[];
  tools: string[];
  responsibilities: string[];
  qualifications: string[];
  keywords: Keyword[];
}

interface Resume {
  _id: string;
  resumeTitle: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const EXP_LABELS: Record<string, string> = {
  Entry: "Entry Level · 0–2 yrs",
  Mid: "Mid Level · 2–5 yrs",
  Senior: "Senior · 5–8 yrs",
  Lead: "Lead / Principal · 8+ yrs",
  Executive: "Executive / Director",
  Unknown: "Experience not specified",
};

const KW_STYLE: Record<string, string> = {
  skill: "bg-indigo-50 text-indigo-700 border-indigo-200",
  tool:  "bg-violet-50 text-violet-700 border-violet-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function PasteJD() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const resumeIdFromQuery = searchParams.get("resumeId")?.trim() || "";

  const [jdText,           setJdText]           = useState("");
  const [isAnalyzing,      setIsAnalyzing]      = useState(false);
  const [isGenerating,     setIsGenerating]     = useState(false);
  const [isOptimizing,     setIsOptimizing]     = useState(false);
  const [analysis,         setAnalysis]         = useState<Analysis | null>(null);
  const [error,            setError]            = useState<string | null>(null);
  const [resumes,          setResumes]          = useState<Resume[]>([]);
  const [selectedResume,   setSelectedResume]   = useState<string>("");
  const [showOptimizeMenu, setShowOptimizeMenu] = useState(false);

  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortCtrlRef   = useRef<AbortController | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/auth");
  }, [isAuthenticated, authLoading, navigate]);

  // Fetch user resumes for "optimize existing" flow
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const abortCtrl = new AbortController();
    resumeAPI.getMyResumes({ signal: abortCtrl.signal })
      .then((response: any) => {
        const list: Resume[] = response?.data?.resumes || [];
        setResumes(list);
        if (list.length) setSelectedResume(list[0]._id);
      })
      .catch((err: any) => {
        // Ignore abort errors
        if (err?.name !== 'AbortError') {
          console.error('Failed to fetch resumes:', err);
        }
      });
    
    return () => abortCtrl.abort();  // ← Cleanup on unmount
  }, [isAuthenticated]);

  // ── Core: call /api/jd/analyze ─────────────────────────────────────────────
  // Returns Analysis object for immediate use in handlers (prevents state race conditions)
  const analyzeJD = useCallback(async (
    text: string,
    silent = false,
    redirectAfterAnalyze = false
  ): Promise<Analysis | null> => {
    if (text.trim().length < 80) return null;
    
    // Cancel previous request if still pending
    if (abortCtrlRef.current) abortCtrlRef.current.abort();
    abortCtrlRef.current = new AbortController();
    
    try {
      setIsAnalyzing(true);
      setError(null);

      const response = await jdAPI.analyzeJD(
        text,
        resumeIdFromQuery || undefined,
        { signal: abortCtrlRef.current.signal }
      );
      
      const jdData = response?.data ?? {};

      const nextAnalysis: Analysis = {
        jdId:            jdData?.jdId ?? "",
        role:            jdData?.roleDetected ?? "Software Engineer",
        experienceLevel: "Unknown",
        skills:          jdData?.extractedKeywords?.filter((k: any) => k.category === 'skill').map((k: any) => k.keyword) ?? [],
        tools:           jdData?.extractedTools ?? [],
        responsibilities: jdData?.extractedResponsibilities ?? [],
        qualifications:  [],
        keywords:        jdData?.extractedKeywords ?? [],
      };

      setAnalysis(nextAnalysis);
      if (!silent) toast.success("Job description analyzed!");
      if (!silent && (redirectAfterAnalyze || !!resumeIdFromQuery) && resumeIdFromQuery) {
        navigate(`/ats-score?id=${resumeIdFromQuery}`);
      }
      return nextAnalysis;  // ← Return for immediate use in handlers
    } catch (err: any) {
      // Ignore abort errors (happens on unmount or new request)
      if (err?.name === 'AbortError') return null;
      
      const msg = err?.message || "Analysis failed. Please try again.";
      setError(msg);
      if (!silent) toast.error(msg);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [navigate, resumeIdFromQuery]);

  // Auto-debounce: analyze 1s after user stops typing (min 150 chars)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (jdText.trim().length < 150) {
      if (jdText.trim().length === 0) setAnalysis(null);
      return;
    }
    debounceRef.current = setTimeout(() => analyzeJD(jdText, true, false), 1000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // Cancel fetch if component unmounts during debounce
      if (abortCtrlRef.current) abortCtrlRef.current.abort();
    };
  }, [jdText, analyzeJD]);

  // ── Generate new resume from JD ────────────────────────────────────────────
  const handleGenerate = async () => {
    if (jdText.trim().length < 50) {
      toast.error("Please paste a job description first.");
      return;
    }
    
    // Use current analysis or analyze first
    let jdId = analysis?.jdId;
    if (!jdId) {
      const analyzed = await analyzeJD(jdText, false, false);
      jdId = analyzed?.jdId;  // ← Use returned data immediately
    }

    if (!jdId) {
      toast.error("Could not analyze the job description. Please try again.");
      return;
    }
    try {
      setIsGenerating(true);
      const res = await jdAPI.generateFromJD(jdId, false);
      
      const resumeId = res?.data?.resumeId;
      
      if (resumeId) {
        console.log('✅ PasteJD: Resume generated with ID:', resumeId);
        toast.success("Resume generated! Opening editor…");
        navigate(`/create-resume?id=${resumeId}&jdId=${jdId}`);
      } else {
        console.error('❌ PasteJD: No resume ID in response:', res);
        toast.error("Resume generated but ID missing. Please try again.");
      }
    } catch (err: any) {
      console.error('❌ PasteJD: Failed to generate resume:', err);
      toast.error(err?.message || "Failed to generate resume.");
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Optimize existing resume ───────────────────────────────────────────────
  const handleOptimize = async () => {
    if (!selectedResume) {
      toast.error("Please select a resume to optimize.");
      return;
    }

    if (jdText.trim().length < 50) {
      toast.error("Please paste a job description first.");
      return;
    }

    // Ensure JD is analyzed
    let jdId = analysis?.jdId;
    if (!jdId) {
      const analyzed = await analyzeJD(jdText, false, false);
      jdId = analyzed?.jdId;
    }

    if (!jdId) {
      toast.error("Could not analyze the job description. Please try again.");
      return;
    }

    try {
      setIsOptimizing(true);
      toast.info("Optimizing your resume with JD keywords…");

      const res = await jdAPI.optimizeResume(jdId, selectedResume);

      if (!res?.success) {
        throw new Error(res?.message || "Failed to optimize resume");
      }

      // Get the resumeId from response (backend returns same ID since it updates in-place)
      const optimizedResumeId = res?.data?.resumeId || selectedResume;

      toast.success("Resume optimized! Opening editor with updated content…");

      // ✅ CORRECT: Navigate to Create Resume editor so user can review & edit the optimized resume
      // Pass optimized=true so CreateResume can show a "View ATS Score" banner
      navigate(`/create-resume?id=${optimizedResumeId}&jdId=${jdId}&optimized=true`);

    } catch (err: any) {
      console.error('❌ PasteJD: Failed to optimize resume:', err);
      toast.error(err?.message || "Failed to optimize resume. Please try again.");
    } finally {
      setIsOptimizing(false);
    }
  };

  // ── Clipboard paste ────────────────────────────────────────────────────────
  const handleClipboardPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJdText(text);
    } catch {
      toast.error("Clipboard access denied — please paste manually (Ctrl+V).");
    }
  };

  // ── Derived display data ───────────────────────────────────────────────────
  const topSkills = (analysis?.keywords ?? [])
    .filter(k => k.category === "skill" || k.category === "tool")
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 18);

  const requirements = [...(analysis?.qualifications ?? []), ...(analysis?.responsibilities ?? [])].slice(0, 6);
  const charCount    = jdText.length;
  const isReady      = charCount >= 50;
  const busy         = isAnalyzing || isGenerating || isOptimizing;

  return (
    <div className="min-h-screen bg-gray-50 font-['Inter']">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-800">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Dashboard
            </Button>
          </Link>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-semibold text-gray-800">Job Description Optimizer</span>
          </div>
          {analysis && (
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs font-medium text-green-700">JD Analyzed</span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Tailor Your Resume to Any Job
          </h1>
          <p className="text-gray-500 text-sm max-w-lg">
            Paste the job description — AI extracts skills, requirements, and keywords,
            then generates or optimizes your resume for a perfect ATS match.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 items-start">

          {/* ── LEFT: Input + Actions ─────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-5">
                {/* Textarea header */}
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    Paste Job Description
                  </label>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 px-2 text-xs text-gray-500 hover:text-indigo-600"
                      onClick={handleClipboardPaste}
                      disabled={busy}
                    >
                      <ClipboardPaste className="w-3 h-3 mr-1" />
                      Paste
                    </Button>
                    {jdText && (
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 px-2 text-xs text-gray-500 hover:text-red-500"
                        onClick={() => { setJdText(""); setAnalysis(null); setError(null); }}
                        disabled={busy}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <Textarea
                  id="jobDescription"
                  name="jobDescription"
                  ref={textareaRef}
                  rows={13}
                  value={jdText}
                  onChange={e => setJdText(e.target.value)}
                  disabled={busy}
                  placeholder={`Paste the full job description here…\n\nExample:\nWe are looking for a Senior Software Engineer with 5+ years of experience in React, Node.js, and cloud technologies. The ideal candidate will design scalable systems and mentor junior engineers…`}
                  className="resize-none text-sm leading-relaxed border-gray-200 focus:border-indigo-400 focus:ring-indigo-400"
                />

                {/* Char count + analyzing indicator */}
                <div className="flex items-center justify-between mt-2 mb-4">
                  <span className={`text-xs tabular-nums transition-colors ${
                    charCount === 0 ? "text-gray-300"
                    : charCount < 50 ? "text-red-400"
                    : charCount < 200 ? "text-yellow-500"
                    : "text-green-500"
                  }`}>
                    {charCount === 0 ? "Start typing or paste above"
                    : charCount < 50 ? `${charCount} / 50 chars minimum`
                    : charCount < 200 ? `${charCount} chars — add more for better results`
                    : `${charCount} chars ✓`}
                  </span>
                  {isAnalyzing && (
                    <span className="flex items-center gap-1 text-xs text-indigo-500">
                      <Loader className="w-3 h-3 animate-spin" />
                      Analyzing…
                    </span>
                  )}
                </div>

                {/* Error banner */}
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3 text-xs text-red-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                {/* Manual re-analyze */}
                {isReady && !isAnalyzing && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mb-3 border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs"
                    onClick={() => analyzeJD(jdText, false, true)}
                    disabled={busy}
                  >
                    <RotateCcw className="w-3 h-3 mr-1.5" />
                    {analysis ? "Re-analyze JD" : "Analyze Job Description"}
                  </Button>
                )}

                {/* ── CTA: Generate new ─────────────────────────────────── */}
                <Button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold mb-2"
                  onClick={handleGenerate}
                  disabled={!isReady || busy}
                >
                  {isGenerating ? (
                    <><Loader className="w-4 h-4 mr-2 animate-spin" />Generating Resume…</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" />Generate Resume from Scratch</>
                  )}
                </Button>

                {/* ── CTA: Optimize existing ────────────────────────────── */}
                {resumes.length > 0 ? (
                  <div>
                    <Button
                      variant="outline"
                      className="w-full font-medium"
                      onClick={() => setShowOptimizeMenu(v => !v)}
                      disabled={!isReady || busy}
                    >
                      <Zap className="w-4 h-4 mr-2 text-indigo-500" />
                      Optimize My Existing Resume
                      <ChevronDown className={`w-4 h-4 ml-auto transition-transform duration-200 ${showOptimizeMenu ? "rotate-180" : ""}`} />
                    </Button>

                    {showOptimizeMenu && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                        <p className="text-xs font-semibold text-gray-600 mb-2">Choose a resume to optimize:</p>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {resumes.map(r => (
                            <label
                              key={r._id}
                              className={`flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer border text-sm transition-all ${
                                selectedResume === r._id
                                  ? "bg-white border-indigo-300 text-indigo-700 shadow-sm"
                                  : "bg-white border-gray-200 text-gray-600 hover:border-indigo-200"
                              }`}
                            >
                              <input
                                type="radio"
                                name="resume-select"
                                value={r._id}
                                checked={selectedResume === r._id}
                                onChange={() => setSelectedResume(r._id)}
                                className="accent-indigo-600 shrink-0"
                              />
                              <FileText className="w-3.5 h-3.5 shrink-0 opacity-60" />
                              <span className="truncate font-medium">{r.resumeTitle || "Untitled Resume"}</span>
                            </label>
                          ))}
                        </div>
                        <Button
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm h-9 mt-1"
                          onClick={handleOptimize}
                          disabled={!selectedResume || busy}
                        >
                          {isOptimizing ? (
                            <><Loader className="w-3.5 h-3.5 mr-2 animate-spin" />Optimizing…</>
                          ) : (
                            <>Optimize & Edit Resume <ArrowRight className="w-3.5 h-3.5 ml-2" /></>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button variant="outline" className="w-full text-gray-400 text-sm" disabled>
                    No resumes yet — generate one first
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* How it works */}
            <Card className="border border-gray-200">
              <CardContent className="p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">How It Works</p>
                <div className="space-y-4">
                  {[
                    { n: "1", title: "Paste JD",             desc: "Copy the full job description from LinkedIn, Naukri, Indeed, or any job portal." },
                    { n: "2", title: "AI Extracts Everything",desc: "We detect role, required skills, experience level, and key requirements in real-time." },
                    { n: "3", title: "Get a Tailored Resume", desc: "Generate a brand-new resume or optimize your existing one to match the role perfectly." },
                  ].map(s => (
                    <div key={s.n} className="flex gap-3">
                      <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[11px] font-bold text-indigo-600">{s.n}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{s.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT: Live Analysis Panel ────────────────────────────────── */}
          <div className="lg:col-span-3">

            {/* Empty / Loading state */}
            {!analysis ? (
              <Card className="border border-dashed border-gray-300 bg-white min-h-[560px]">
                <CardContent className="p-10 flex flex-col items-center justify-center min-h-[560px] text-center gap-5">
                  {isAnalyzing ? (
                    <>
                      <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                          <Loader className="w-8 h-8 text-indigo-500 animate-spin" />
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-lg">Analyzing Job Description…</p>
                        <p className="text-sm text-gray-400 mt-1">Extracting skills, requirements & keywords</p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center max-w-xs">
                        {["Role detection", "Skill extraction", "Requirement analysis", "Keyword scoring"].map(s => (
                          <span key={s} className="px-2.5 py-1 bg-indigo-50 text-indigo-400 text-xs rounded-full animate-pulse">{s}</span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-indigo-200" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-600 text-lg">Analysis will appear here</p>
                        <p className="text-sm text-gray-400 mt-1">Paste a job description on the left — results update automatically</p>
                      </div>
                      {/* Skeleton preview */}
                      <div className="grid grid-cols-3 gap-3 w-full max-w-md mt-2">
                        {["Detected Role", "Required Skills", "Key Requirements"].map(label => (
                          <div key={label} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-center">
                            <div className="h-2 bg-gray-200 rounded mb-2 animate-pulse" />
                            <div className="h-2 bg-gray-100 rounded w-2/3 mx-auto animate-pulse" />
                            <p className="text-[11px] text-gray-300 mt-2">{label}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* ── Analysis Results ─────────────────────────────────────── */
              <div className="space-y-4">

                {/* Role Banner */}
                <Card className="border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-widest mb-1">Detected Role</p>
                        <h2 className="text-2xl font-bold text-gray-900">{analysis.role}</h2>
                      </div>
                      <div className="flex flex-col gap-1.5 items-end">
                        <span className="px-3 py-1 bg-white border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-full shadow-sm">
                          {EXP_LABELS[analysis.experienceLevel] ?? analysis.experienceLevel}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" />
                          {topSkills.length} skills · {analysis.keywords.length} keywords extracted
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Skills */}
                {topSkills.length > 0 && (
                  <Card className="border border-gray-200">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        Extracted Keywords
                        <span className="ml-auto text-xs font-normal text-gray-400">sorted by frequency</span>
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {topSkills.map(kw => (
                          <span
                            key={kw.keyword}
                            title={`${kw.category} · mentioned ${kw.frequency}×`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${KW_STYLE[kw.category] ?? KW_STYLE.other}`}
                          >
                            {kw.keyword}
                            {kw.frequency > 1 && (
                              <span className="opacity-50 text-[10px]">×{kw.frequency}</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Extracted Tools */}
                  {analysis.tools.length > 0 && (
                    <Card className="border border-gray-200">
                      <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-violet-500" />
                          Extracted Tools
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.tools.slice(0, 12).map((tool, i) => (
                            <span
                              key={`${tool}-${i}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-violet-50 text-violet-700 border-violet-200"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Key Requirements */}
                  {requirements.length > 0 && (
                    <Card className="border border-gray-200">
                      <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          Key Requirements
                        </h3>
                        <ul className="space-y-2">
                          {requirements.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-700 leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 mt-1.5" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Responsibilities */}
                  {analysis.responsibilities.length > 0 && (
                    <Card className="border border-gray-200">
                      <CardContent className="p-5">
                        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                          <Target className="w-4 h-4 text-indigo-500" />
                          Extracted Responsibilities
                        </h3>
                        <ul className="space-y-2">
                          {analysis.responsibilities.slice(0, 5).map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-700 leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* All keywords */}
                {analysis.keywords.length > topSkills.length && (
                  <Card className="border border-gray-200">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-blue-500" />
                        All Extracted Keywords
                        <span className="text-xs font-normal text-gray-400 ml-1">({analysis.keywords.length} total)</span>
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.keywords.slice(0, 30).map(kw => (
                          <span
                            key={kw.keyword}
                            className={`px-2 py-0.5 rounded text-xs border ${KW_STYLE[kw.category] ?? KW_STYLE.other}`}
                          >
                            {kw.keyword}
                          </span>
                        ))}
                        {analysis.keywords.length > 30 && (
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-50 text-gray-400 border border-gray-200">
                            +{analysis.keywords.length - 30} more
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Ready CTA tip */}
                <Card className="border border-indigo-200 bg-indigo-50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-indigo-800 mb-0.5">Ready to optimize</p>
                        <p className="text-xs text-indigo-700 leading-relaxed">
                          We found <strong>{topSkills.length} skills</strong> and <strong>{analysis.responsibilities.length} responsibilities</strong>.
                          Click <em>Generate New Resume</em> to create a fully tailored resume, or select an existing resume and click <em>Optimize</em> to boost your ATS score.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
