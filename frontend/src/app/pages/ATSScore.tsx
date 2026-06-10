import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";

import {
  ChevronLeft, CheckCircle, AlertCircle, Zap,
  Loader, TrendingUp, Target, FileText, RefreshCw, Sparkles, ArrowRight
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { atsAPI, resumeAPI } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { Skeleton } from "../components/ui/skeleton";
import StepProgress from "../components/StepProgress";

/** ── Loading UI Component ── */
const LoadingSkeleton = () => (
  <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
    <div className="flex justify-between items-center mb-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32" />
    </div>
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <Card className="p-8"><Skeleton className="h-64 w-full" /></Card>
        <Card className="p-8"><Skeleton className="h-48 w-full" /></Card>
      </div>
      <div className="lg:col-span-2 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  </div>
);

// ──────────────────── TYPES ────────────────────

interface Suggestion {
  id: string;
  section: string;
  itemIndex?: number;
  bulletIndex?: number;
  currentText: string;
  improvedText: string;
  impact: "high" | "medium" | "low";
  reason: string;
  type: string;
}

interface ScoreBreakdown {
  keyword_match?: number;
  formatting?: number;
  completeness?: number;
  action_verbs?: number;
  readability?: number;
}

interface OverallFeedback {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

interface MatchedSkill {
  keyword: string;
  matchType: 'exact' | 'synonym';
  frequency: number;
  confidence: number;
  sections: string[];
  weightApplied: number;
}

interface MissingSkill {
  keyword: string;
  type: 'hard' | 'context';
  weight: number;
}

interface SkillGapData {
  matchedSkills: MatchedSkill[];
  missingSkills: MissingSkill[];
  matchPercentage: number;
  predictedScore: number | null;
  totalKeywords: number;
  matchedCount: number;
  missingCount: number;
}

// Legacy — kept for existing scoreData.skillGap compatibility
interface SkillGap {
  present: string[];
  missing: string[];
}

// ──────────────────── HELPERS ────────────────────

/** Safely normalize any impact value to "high" | "medium" | "low" */
const safeImpact = (impact: any): "high" | "medium" | "low" => {
  if (typeof impact === "number") {
    if (impact >= 8) return "high";
    if (impact >= 5) return "medium";
    return "low";
  }
  if (typeof impact === "string") {
    const l = impact.toLowerCase().trim();
    if (l === "high" || l === "critical") return "high";
    if (l === "medium" || l === "important" || l === "moderate") return "medium";
    return "low";
  }
  return "low";
};

const getScoreColor = (s: number) =>
  s >= 80 ? "text-green-600" : s >= 60 ? "text-yellow-600" : "text-red-600";

const getScoreStroke = (s: number) =>
  s >= 80 ? "#10B981" : s >= 60 ? "#EAB308" : "#EF4444";

const getScoreLabel = (s: number) =>
  s >= 80
    ? { text: "Excellent", bg: "bg-green-50", tc: "text-green-700" }
    : s >= 60
    ? { text: "Good",      bg: "bg-yellow-50", tc: "text-yellow-700" }
    : { text: "Needs Work", bg: "bg-red-50",   tc: "text-red-700" };

const impactConfig = {
  high:   { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500",    label: "HIGH" },
  medium: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500", label: "MEDIUM" },
  low:    { bg: "bg-blue-100",   text: "text-blue-700",   dot: "bg-blue-500",   label: "LOW" },
};

/** Normalize breakdown fields from backend response */
const normalizeBreakdown = (bd: any): ScoreBreakdown => {
  if (!bd) return {};
  
  // Backend returns flat structure: keywordMatch, sectionCompleteness, formatting, actionVerbs, readability
  // Map to UI keys for display
  return {
    keyword_match: bd.keywordMatch ?? 0,
    formatting:    bd.formatting ?? 0,
    completeness:  bd.sectionCompleteness ?? 0,  // ✅ FIXED: Was looking for wrong keys
    action_verbs:  bd.actionVerbs ?? 0,          // ✅ FIXED: Was looking for wrong keys
    readability:   bd.readability ?? 0,
  };
};

// ──────────────────── COMPONENT ────────────────────

export default function ATSScore() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const resumeId = searchParams.get("id");

  console.log("🔵 ATSScore component MOUNTED with resumeId:", resumeId);

  // Prevent concurrent apply operations
  const isApplyingRef = useRef(false);

  const hasResumeId = !!resumeId?.trim();

  const [isLoading,        setIsLoading]        = useState(true);
  const [isApplying,       setIsApplying]        = useState<string | "all" | null>(null);
  const [score,            setScore]             = useState<number | null>(null);
  const [hasJdLinked,      setHasJdLinked]       = useState(false);
  const [jdId,             setJdId]              = useState<string | null>(null);
  const [scoringMode,      setScoringMode]       = useState<"general" | "job-specific" | "no-jd">("no-jd");
  const [breakdown,        setBreakdown]         = useState<ScoreBreakdown>({});
  const [suggestions,      setSuggestions]       = useState<Suggestion[]>([]);
  const [missingKeywords,  setMissingKeywords]   = useState<string[]>([]);
  const [missingSections,  setMissingSections]   = useState<string[]>([]);
  const [scoreMessage,     setScoreMessage]      = useState("");
  const [overallFeedback,  setOverallFeedback]   = useState<OverallFeedback | null>(null);
  const [activeFilter,     setActiveFilter]      = useState<"all" | "high" | "medium" | "low">("all");
  const [isRedirecting,    setIsRedirecting]     = useState(false);

  // ── New feature state ────────────────────────────────────────────────────
  const [skillGap,         setSkillGap]          = useState<SkillGap>({ present: [], missing: [] });
  const [matchPercentage,  setMatchPercentage]   = useState<number | null>(null);
  const [skillGapData,     setSkillGapData]      = useState<SkillGapData | null>(null);
  const [isAutoFixing,     setIsAutoFixing]      = useState(false);
  const [autoFixResult,    setAutoFixResult]     = useState<{ scoreBefore: number; scoreAfter: number; added: string[] } | null>(null);
  
  // ── Career Copilot AI State ──────────────────────────────────────────────
  const [semanticScore,    setSemanticScore]     = useState<number | null>(null);
  const [keywordScore,     setKeywordScore]      = useState<number | null>(null);
  const [reasons,          setReasons]           = useState<any[]>([]);
  const [nextSteps,        setNextSteps]         = useState<string[]>([]);
  const [semanticMatches,  setSemanticMatches]   = useState<any[]>([]);

  // ── AI Rewrite State ─────────────────────────────────────────────────────
  const [isImprovingAI,      setIsImprovingAI]    = useState(false);
  const [aiPreview,          setAiPreview]        = useState<any>(null);
  const [aiApplySections,    setAiApplySections]  = useState({ summary: true, projects: true, skills: true });
  // rewriteResult holds the full response from /api/ats/rewrite
  const [rewriteResult,      setRewriteResult]    = useState<any>(null);

  // ── Auth Guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/auth");
  }, [isAuthenticated, authLoading, navigate]);
  // ── Load ATS Score ────────────────────────────────────────────────────────
  const loadATSScore = useCallback(async () => {
    if (!resumeId) {
      console.error("🔥 ATSScore: No resumeId provided");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      console.log("🔵 ATSScore: Starting loadATSScore for resumeId:", resumeId);

      // 1. Check if JD is linked
      const resumeResponse = await resumeAPI.getResumeById(resumeId);
      const resumeData = resumeResponse?.data;
      const jdLinked = Boolean(resumeData?.jdId);
      const jdId = resumeData?.jdId;
      
      console.log("🔵 ATSScore: Loaded resume, jdLinked:", jdLinked, "jdId:", jdId);
      setHasJdLinked(jdLinked);
      setJdId(jdId);  // ✅ Store jdId in state for later use

      if (!jdLinked) {
        console.log("⚠️ ATSScore: No JD linked, showing 'Add Job Description' prompt");
        setScore(null);
        setScoringMode("no-jd");
        setBreakdown({});
        setMissingKeywords([]);
        setMissingSections([]);
        setScoreMessage("Add a Job Description to calculate your ATS Score and see keyword matches.");
        setOverallFeedback(null);
        setSuggestions([]);
        setSkillGap({ present: [], missing: [] });
        setMatchPercentage(null);
        setIsLoading(false);
        return;
      }

      // 2. Calculate fresh ATS score
      console.log("🔵 ATSScore: Fetching ATS score...");
      const scoreResponse = await atsAPI.calculateScore(resumeId);
      
      if (!scoreResponse) {
        throw new Error("Server returned empty response");
      }

      console.log("✅ ATSScore: Score response:", JSON.stringify(scoreResponse, null, 2));

      console.log("🔥 ATS FRONTEND RAW RESPONSE:", scoreResponse);

      // api.ts already normalizes fields to top level — read directly
      const scoreData = scoreResponse;

      // Guard: only fail if no response at all
      if (!scoreData) {
        console.error("❌ ATSScore: Null response");
        setScoreMessage("⚠️ Failed to analyze resume");
        setIsLoading(false);
        return;
      }

      // 5. Map from api.ts normalized shape
      // api.ts exposes: totalScore, breakdown (normalized), suggestions (normalized)
      // scoreData.data holds the raw backend payload for any extra fields
      const resolvedScore = scoreData.totalScore ?? scoreData.data?.score ?? 0;
      console.log("✅ ATSScore: Score resolved to:", resolvedScore);

      // Breakdown: api.ts normalizeBreakdown already maps to { keywordMatch, completeness, formatting, actionVerbs, readability }
      const bd = scoreData.breakdown || {};
      setScore(resolvedScore);
      setScoringMode(scoreData.scoringMode || "job-specific");
      setBreakdown({
        keyword_match: bd.keywordMatch        ?? 0,
        completeness:  bd.completeness        ?? bd.sectionCompleteness ?? 0,
        formatting:    bd.formatting          ?? 0,
        action_verbs:  bd.actionVerbs         ?? 0,
        readability:   bd.readability         ?? 0,
      });
      setMissingKeywords(scoreData.missingKeywords ?? scoreData.data?.missingKeywords ?? []);
      setMissingSections(scoreData.missingSections ?? scoreData.data?.missingSections ?? []);
      setScoreMessage("");

      // Match percentage
      const mp = resolvedScore;
      setMatchPercentage(mp);

      // Overall feedback
      const of_ = scoreData.overallFeedback || scoreData.data?.overallFeedback || {};
      setOverallFeedback({
        strengths:       of_.strengths       ?? [],
        weaknesses:      of_.weaknesses      ?? [],
        recommendations: of_.recommendations ?? [],
      });

      // Skill gap — raw payload in scoreData.data
      const rawData = scoreData.data || {};
      setSkillGapData({
        matchedSkills:   rawData.matchedSkills  ?? [],
        missingSkills:   rawData.missingSkills  ?? [],
        matchPercentage: rawData.matchPercentage ?? mp,
        predictedScore:  rawData.predictedScore  ?? null,
        totalKeywords:   rawData.totalKeywords   ?? 0,
        matchedCount:    rawData.matchedCount    ?? 0,
        missingCount:    rawData.missingCount    ?? 0,
      });

      // Legacy skillGap shape
      if (rawData.skillGap) {
        setSkillGap(rawData.skillGap);
      } else {
        setSkillGap({
          present: (rawData.matchedSkills ?? []).map((s: any) => typeof s === 'string' ? s : s.keyword),
          missing: (rawData.missingSkills ?? []).map((s: any) => typeof s === 'string' ? s : s.keyword),
        });
      }

      // Suggestions: api.ts normalizeSuggestions already processes these
      setSuggestions(scoreData.suggestions ?? []);

      // Career Copilot State Hook Mapping
      setSemanticScore(scoreData.data?.semanticScore ?? scoreData.semanticScore ?? null);
      setKeywordScore(scoreData.data?.keywordScore ?? scoreData.keywordScore ?? null);
      setReasons(scoreData.data?.reasons ?? scoreData.reasons ?? []);
      setNextSteps(scoreData.data?.nextSteps ?? scoreData.nextSteps ?? []);
      setSemanticMatches(scoreData.data?.semanticMatches ?? scoreData.semanticMatches ?? []);

      console.log("✅ ATSScore: Page fully updated. Score:", resolvedScore, "| Suggestions:", (scoreData.suggestions ?? []).length, "| SkillGap matched:", (rawData.matchedSkills ?? []).length);
      
    } catch (error) {
      console.error("🔥 ATSScore ERROR:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to load ATS score";
      
      if (errorMsg.includes("empty response")) {
        toast.error("Backend error: Server returned empty response. Check if backend is running.");
      } else if (errorMsg.includes("401") || errorMsg.includes("Unauthorized")) {
        toast.error("Session expired. Please login again.");
        setTimeout(() => navigate("/auth"), 2000);
      } else if (errorMsg.includes("400") || errorMsg.includes("analyzed")) {
        setScoreMessage("⚠️ JD analysis required to compute match");
      } else {
        toast.error(`Error: ${errorMsg}`);
      }
      
      setScore(0);
      setBreakdown({});
      setSuggestions([]);
      setMissingKeywords([]);
      setMissingSections([]);
      setOverallFeedback(null);
      setSkillGap({ present: [], missing: [] });
      setSkillGapData(null);
      setMatchPercentage(0);
      
    } finally {
      setIsLoading(false);
    }
  }, [resumeId, jdId, navigate]);
  // ── Initial Load & State Reset ──────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !isAuthenticated || isRedirecting || !hasResumeId) return;

    const trimmed = resumeId!.trim();
    if (!/^[0-9a-f]{24}$/i.test(trimmed)) {
      toast.error("Invalid resume ID. Returning to dashboard...");
      setIsRedirecting(true);
      setTimeout(() => navigate("/dashboard"), 1500);
      return;
    }

    // Only clear the status message \u2014 do NOT reset score/suggestions/skillGap
    // so the old values remain visible while loading avoids blank flash
    setScoreMessage("");
    
    // Load fresh data
    loadATSScore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasResumeId, resumeId, jdId, isAuthenticated, authLoading, isRedirecting, loadATSScore]);

  // ── Apply Single Suggestion ────────────────────────────────────────────
  const applySuggestion = async (suggestion: any) => {
    if (!resumeId || !jdId || isApplyingRef.current) return;

    try {
      isApplyingRef.current = true;
      setIsApplying(suggestion.id);

      console.log(`[applySuggestion] Applying:`, {
        id: suggestion.id,
        section: suggestion.section,
        improvedText: suggestion.improvedText?.substring(0, 50),
      });

      const result = await atsAPI.applySuggestion(resumeId, jdId, {
        section: suggestion.section,
        itemIndex: suggestion.itemIndex,
        bulletIndex: suggestion.bulletIndex,
        improvedText: suggestion.improvedText,
        suggestedText: suggestion.suggestedText || suggestion.improvedText,
        suggestionId: suggestion.id,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      // Update score
      if (result.data?.updatedScore != null) {
        setScore(result.data.updatedScore);
        console.log(`[applySuggestion] Score updated:`, result.data.updatedScore);
      }

      // Update breakdown
      if (result.data?.updatedBreakdown) {
        setBreakdown(result.data.updatedBreakdown);
      }

      // Update suggestions list with fresh data from server
      if (result.data?.updatedSuggestions) {
        const newSuggestions = (result.data.updatedSuggestions || []).map((s: any) => ({
          id: s.id,
          section: s.section,
          itemIndex: s.itemIndex,
          bulletIndex: s.bulletIndex,
          currentText: s.currentText || '',
          improvedText: s.improvedText || '',
          impact: s.impact,
          reason: s.reason,
          type: s.type,
        }));

        setSuggestions(newSuggestions);
        console.log(`[applySuggestion] Suggestions updated:`, newSuggestions.length, "remaining");
      }

      // Update keywords and feedback
      if (result.data?.missingKeywords) {
        setMissingKeywords(result.data.missingKeywords);
      }

      if (result.data?.overallFeedback) {
        setOverallFeedback(result.data.overallFeedback);
      }

      toast.success('Suggestion applied!');

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to apply';
      console.error('[applySuggestion]', msg);
      toast.error(msg);
    } finally {
      isApplyingRef.current = false;
      setIsApplying(null);
    }
  };

  // ── Apply All Suggestions ──────────────────────────────────────────────
  const applyAllSuggestions = async () => {
    if (!resumeId || !jdId || isApplyingRef.current) return;

    const suggestionCount = suggestions.length;

    if (suggestionCount === 0) {
      toast.info('No suggestions available.');
      return;
    }

    try {
      isApplyingRef.current = true;
      setIsApplying('all');

      console.log(`[applyAllSuggestions] Starting batch apply:`, {
        totalCount: suggestionCount,
      });

      const result = await atsAPI.applyAllSuggestions(resumeId, jdId);

      if (!result.success) {
        throw new Error(result.message);
      }

      const applied = result.data.appliedCount || 0;

      console.log(`[applyAllSuggestions] Batch complete:`, {
        appliedCount: applied,
        totalCount: suggestionCount,
      });

      if (applied > 0) {
        // Update score first for immediate visual feedback
        if (result.data?.updatedScore != null) {
          setScore(result.data.updatedScore);
          console.log(`[applyAllSuggestions] Score updated:`, result.data.updatedScore);
        }

        // Update breakdown
        if (result.data?.updatedBreakdown) {
          setBreakdown(result.data.updatedBreakdown);
        }

        // Update suggestions with fresh data from server
        if (result.data?.updatedSuggestions) {
          const newSuggestions = (result.data.updatedSuggestions || []).map((s: any) => ({
            id: s.id,
            section: s.section,
            itemIndex: s.itemIndex,
            bulletIndex: s.bulletIndex,
            currentText: s.currentText || '',
            improvedText: s.improvedText || '',
            impact: s.impact,
            reason: s.reason,
            type: s.type,
          }));

          setSuggestions(newSuggestions);
        }

        // Update keywords and feedback
        if (result.data?.missingKeywords) {
          setMissingKeywords(result.data.missingKeywords);
        }

        if (result.data?.overallFeedback) {
          setOverallFeedback(result.data.overallFeedback);
        }

        // Show success message
        const plural = applied !== 1 ? 'es' : '';
        toast.success(`✅ Applied ${applied} fix${plural}!`);
      } else {
        toast.info('No changes were made.');
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[applyAllSuggestions]', msg);
      toast.error(`Failed to apply fixes: ${msg}`);
    } finally {
      isApplyingRef.current = false;
      setIsApplying(null);
    }
  };

  const refreshScore = () => loadATSScore();

  // ── Auto Fix Handler ──────────────────────────────────────────────────────
  const handleAutoFix = async () => {
    if (!resumeId || !jdId || isAutoFixing) return;
    try {
      setIsAutoFixing(true);
      toast.info('🔧 Auto-fixing resume skills…');
      const result = await atsAPI.autoFixSkillGap(resumeId, jdId);
      if (result.success) {
        setAutoFixResult({
          scoreBefore: result.data.scoreBefore ?? 0,
          scoreAfter:  result.data.scoreAfter  ?? 0,
          added:       result.data.addedKeywords ?? [],
        });
        if (result.data.scoreAfter != null) setScore(result.data.scoreAfter);
        if (result.data.updatedBreakdown) setBreakdown(result.data.updatedBreakdown);
        // Reload all data from single source of truth
        await loadATSScore();
        toast.success(`✅ Auto-fix done! Score: ${result.data.scoreBefore} → ${result.data.scoreAfter}`);
      } else {
        toast.error(result.message || 'Auto-fix failed.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Auto-fix failed.');
    } finally {
      setIsAutoFixing(false);
    }
  };

  // ── AI Rewrite Handler (POST /api/ats/rewrite) ───────────────────────────
  const improveWithAI = async () => {
    if (!resumeId || !jdId) {
      toast.error('A linked Job Description is required to use AI improvement.');
      return;
    }
    try {
      setIsImprovingAI(true);
      toast.info('✨ AI is rewriting your resume…');
      const res = await atsAPI.rewriteResume(resumeId);
      if (res.success) {
        setRewriteResult(res);
        setAiPreview(res.diff);   // diff drives the modal
        setAiApplySections({ summary: true, projects: true, skills: true });
        if (res.isFallback) {
          toast.warning('AI is temporarily busy — showing offline suggestions.');
        } else {
          const delta = res.scoreDelta ?? 0;
          toast.success(`✅ AI rewrite ready! Projected score boost: +${delta} pts`);
        }
      } else {
        toast.error(res.message || 'AI improvement failed. Please try again.');
      }
    } catch (err: any) {
      const msg = err?.message || 'AI service is unavailable.';
      if (msg.includes('503') || msg.includes('unavailable')) {
        toast.error('AI is currently unavailable. Please check your GEMINI_API_KEY.');
      } else if (msg.includes('quota') || msg.includes('429')) {
        toast.error('AI quota exceeded. Please try again later.');
      } else {
        toast.error(msg);
      }
    } finally {
      setIsImprovingAI(false);
    }
  };

  /** Apply the AI-rewritten sections to the resume via update API */
  const applyAIImprovements = async () => {
    if (!aiPreview || !resumeId || !rewriteResult) return;
    try {
      const patch: Record<string, any> = {};
      const rewritten = rewriteResult.rewrittenResume;

      if (aiApplySections.summary && rewritten?.summary) {
        patch.summary = rewritten.summary;
      }

      if (aiApplySections.projects && rewritten?.projects?.length) {
        patch.projects = rewritten.projects.map((p: any) => ({
          title:     p.title || '',
          bullets:   Array.isArray(p.bullets) ? p.bullets : [],
          techStack: p.techStack || [],
          link:      p.link || '',
        }));
      }

      if (aiApplySections.skills && rewriteResult.diff?.skills?.added?.length) {
        // Merge added skills as a new category — backend can deduplicate
        patch.skills = [
          ...(rewritten?.skills || []),
        ];
      }

      if (Object.keys(patch).length === 0) {
        toast.info('No sections selected to apply.');
        return;
      }

      await resumeAPI.update(resumeId, patch);
      setAiPreview(null);
      setRewriteResult(null);
      toast.success('✅ AI improvements applied! Re-scoring…');
      loadATSScore();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to apply AI improvements.');
    }
  };

  // ── Derived State ───────────────────────────────────────────────────────
  const filteredSuggestions =
    activeFilter === "all"
      ? suggestions
      : suggestions.filter(s => safeImpact(s.impact) === activeFilter);

  const hasValidScore = score !== null && score !== undefined && score > 0;
  const shouldShowNoSuggestionsPlaceholder =
    activeFilter === "all" &&
    hasValidScore &&
    (score as number) >= 85 &&
    missingKeywords.length === 0 &&
    missingSections.length === 0 &&
    suggestions.length === 0;

  const showJdRequiredState = !hasJdLinked;
  const progressValue = hasValidScore ? (score as number) : 0;
  const circumference = 2 * Math.PI * 88;
  const strokeDash    = (progressValue / 100) * circumference;
  const scoreLabel    = getScoreLabel(progressValue);
  const noJDMessage   = scoreMessage || "Add a Job Description to calculate ATS Score and see keyword match.";

  // Count by impact
  const impactCounts = {
    all:    suggestions.length,
    high:   suggestions.filter(s => safeImpact(s.impact) === "high").length,
    medium: suggestions.filter(s => safeImpact(s.impact) === "medium").length,
    low:    suggestions.filter(s => safeImpact(s.impact) === "low").length,
  };

  // ── Empty State (no resumeId) ─────────────────────────────────────────────
  if (!hasResumeId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16 gap-4">
              <Link to="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Dashboard</span>
              </Link>
              <div className="w-px h-5 bg-gray-300" />
              <h1 className="text-lg font-semibold text-gray-900">ATS Score Report</h1>
            </div>
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 py-16">
          <Card className="border border-gray-200">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Target className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">Select a Resume to Analyze</h2>
              <p className="text-gray-600 mb-8">Choose a resume from your dashboard to view its ATS score.</p>
              <Link to="/dashboard">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">Go to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ── Loading State ─────────────────────────────────────────────────────────
  if (isLoading) return <LoadingSkeleton />;

  // ── Main Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Dashboard</span>
              </Link>
              <div className="w-px h-5 bg-gray-300" />
              <h1 className="text-lg font-semibold text-gray-900">ATS Score Report</h1>
            </div>

            <div className="flex items-center gap-3">
              {!showJdRequiredState && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshScore}
                  className="text-gray-500 hover:text-gray-700"
                  disabled={isLoading || isApplying !== null}
                  title="Refresh score"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              )}

              {!showJdRequiredState && resumeId && jdId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/interview/${resumeId}/${jdId}`)}
                  className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:text-purple-800"
                  disabled={isLoading || isApplying !== null}
                >
                  🎤 Start AI Interview
                </Button>
              )}

              {hasValidScore && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${scoreLabel.bg} ${scoreLabel.tc}`}>
                  <span>{score}/100</span>
                  <span>·</span>
                  <span>{scoreLabel.text}</span>
                </div>
              )}

              {filteredSuggestions.length > 0 && (
                <Button
                  size="sm"
                  onClick={applyAllSuggestions}
                  disabled={isApplying !== null || isImprovingAI}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {isApplying === "all"
                    ? <><Loader className="w-4 h-4 mr-1.5 animate-spin" />Applying…</>
                    : <><Zap className="w-4 h-4 mr-1.5" />Apply All Fixes ({filteredSuggestions.length})</>
                  }
                </Button>
              )}

              {/* ── AI Improve Button ──────────────────────────────────── */}
              {hasJdLinked && (
                <Button
                  size="sm"
                  onClick={improveWithAI}
                  disabled={isImprovingAI || isApplying !== null}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md"
                >
                  {isImprovingAI
                    ? <><Loader className="w-4 h-4 mr-1.5 animate-spin" />AI Working…</>
                    : <><Sparkles className="w-4 h-4 mr-1.5" />Improve with AI</>
                  }
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <StepProgress currentStep={3} />
        </div>

        {/* ── JD Required Banner ─────────────────────────────────────────── */}
        {showJdRequiredState && (
          <Card className="border border-orange-200 bg-orange-50">
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-bold text-orange-800 mb-3">Job Description Required</h2>
              <p className="text-sm text-orange-700 mb-6">
                Add a Job Description to calculate your ATS Score and see which keywords are missing.
              </p>
              <Button
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => navigate(`/ats/add-jd?id=${resumeId}`)}
              >
                Add Job Description
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Main Content ────────────────────────────────────────────────── */}
        {!showJdRequiredState && (
          <div className="grid lg:grid-cols-3 gap-8">

            {/* ── Left Column: Score + Breakdown ────────────────────────── */}
            <div className="lg:col-span-1 space-y-6">

              <Card className="border border-gray-200">
                <CardContent className="p-8">
                  <h2 className="text-base font-semibold text-gray-900 mb-6 text-center">ATS Score</h2>

                  {hasValidScore ? (
                    <div className="relative w-48 h-48 mx-auto mb-6">
                      <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 192 192">
                        <circle cx="96" cy="96" r="88" stroke="#E5E7EB" strokeWidth="12" fill="none" />
                        <circle
                          cx="96" cy="96" r="88"
                          stroke={getScoreStroke(progressValue)}
                          strokeWidth="12"
                          fill="none"
                          strokeDasharray={`${strokeDash} ${circumference}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className={`text-5xl font-bold ${getScoreColor(progressValue)}`}>{score}</div>
                          <div className="text-xs text-gray-400 mt-1">out of 100</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                      <p className="text-sm font-medium text-amber-800">{noJDMessage}</p>
                    </div>
                  )}

                  {hasValidScore && (
                    <>
                      <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full mb-3 ${scoreLabel.bg}`}>
                        {progressValue >= 80
                          ? <CheckCircle className={`w-4 h-4 ${scoreLabel.tc}`} />
                          : <AlertCircle className={`w-4 h-4 ${scoreLabel.tc}`} />}
                        <span className={`text-sm font-semibold ${scoreLabel.tc}`}>{scoreLabel.text}</span>
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        {progressValue >= 80
                          ? "Your resume is highly optimized for ATS!"
                          : progressValue >= 60
                          ? "Good foundation — apply suggestions to boost."
                          : "Several improvements needed."}
                      </p>
                    </>
                  )}

                  {/* Match Percentage & Hybrid Breakdowns */}
                  {matchPercentage !== null && (
                    <div className="mt-8 pt-6 border-t border-gray-100">
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Hybrid Matching Engine</h3>
                        <p className="text-xs text-gray-500 mb-3">Your score is a blend of exact keywords and semantic meaning alignment.</p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-600 font-medium tracking-wide">Semantic Theme Alignment</span>
                            <span className={`text-xs font-bold ${getScoreColor(semanticScore || 0)}`}>{semanticScore}%</span>
                          </div>
                          <Progress value={semanticScore || 0} className="h-2" />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-600 font-medium tracking-wide">Exact Keyword Match</span>
                            <span className={`text-xs font-bold ${getScoreColor(keywordScore || 0)}`}>{keywordScore}%</span>
                          </div>
                          <Progress value={keywordScore || 0} className="h-2 bg-gray-100" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Career Copilot AI Insights ── */}
                  {(reasons.length > 0 || nextSteps.length > 0) && (
                    <div className="mt-6 pt-6 border-t border-gray-100 space-y-5">
                      
                      {reasons.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                            <AlertCircle className="w-4 h-4 text-rose-500" />
                            Why Your Score is Low
                          </h3>
                          <ul className="space-y-2">
                            {reasons.map((r, i) => (
                              <li key={i} className="text-xs bg-rose-50/50 border border-rose-100 rounded-md p-2">
                                <span className="font-semibold text-rose-800 block mb-0.5">{r.message}</span>
                                <span className="text-rose-600 block leading-tight">Impact: {r.impact}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {nextSteps.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            What You Should Do Next
                          </h3>
                          <ul className="space-y-2">
                            {nextSteps.map((step, i) => (
                              <li key={i} className="text-xs bg-emerald-50/50 border border-emerald-100 rounded-md p-2 flex items-start gap-2">
                                <span className="text-emerald-500 mt-0.5 font-bold">→</span>
                                <span className="text-emerald-800 leading-tight">{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                    </div>
                  )}

                  {/* Score Breakdown */}
                  <div className="mt-6 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Score Breakdown</h3>

                    {(() => {
                      // Define weights based on scoringMode
                      const breakdownWeights = (scoringMode === 'job-specific' || scoringMode === 'general')
                        ? [
                            { key: 'keyword_match', label: 'Keyword Match', weight: 40 },
                            { key: 'formatting', label: 'Formatting', weight: 20 },
                            { key: 'completeness', label: 'Completeness', weight: 20 },
                            { key: 'action_verbs', label: 'Action Verbs', weight: 10 },
                            { key: 'readability', label: 'Readability', weight: 10 },
                          ]
                        : [
                            { key: 'formatting', label: 'Formatting', weight: 30 },
                            { key: 'completeness', label: 'Completeness', weight: 30 },
                            { key: 'action_verbs', label: 'Action Verbs', weight: 20 },
                            { key: 'readability', label: 'Readability', weight: 20 },
                          ];

                      return (
                        <>
                          {breakdownWeights.map(({ key, label, weight }) => {
                            const val = (breakdown as any)[key] ?? 0;
                            return (
                              <div key={key}>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-600">{label}</span>
                                    <span className="text-xs text-gray-400">({weight}%)</span>
                                  </div>
                                  <span className={`text-xs font-bold ${getScoreColor(val)}`}>{val}%</span>
                                </div>
                                <Progress value={val} className="h-1.5" />
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>

                  {/* Missing Keywords */}
                  {missingKeywords.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Target className="w-4 h-4 text-red-500" />
                        Missing Keywords ({missingKeywords.length})
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {missingKeywords.slice(0, 12).map(kw => (
                          <span key={kw} className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                            {kw}
                          </span>
                        ))}
                        {missingKeywords.length > 12 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                            +{missingKeywords.length - 12} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Missing Sections */}
                  {missingSections.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        Missing Sections ({missingSections.length})
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {missingSections.map(sec => (
                          <span key={sec} className="px-2 py-0.5 bg-amber-50 text-amber-800 text-xs rounded border border-amber-200">
                            {sec}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Semantic Matches Visualizer */}
                  {semanticMatches.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <h3 className="text-sm font-semibold text-indigo-700 mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        Semantic Insights
                      </h3>
                      <p className="text-xs text-gray-500 mb-3">The AI engine understood these contextual synonyms automatically:</p>
                      <div className="space-y-2">
                        {semanticMatches.map((sm, i) => (
                          <div key={i} className="flex flex-col text-[11px] bg-indigo-50 rounded px-2 py-1.5 border border-indigo-100">
                            <div className="flex justify-between font-medium">
                              <span className="text-indigo-800 line-clamp-1 flex-1">JD: "{sm.jdSkill}"</span>
                              <span className="text-indigo-600 ml-2">{(sm.confidence * 100).toFixed(0)}%</span>
                            </div>
                            <span className="text-gray-500">Resume: "{sm.matchedWith}"</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Skill Gap Dashboard ────────────────────────────────── */}
              {skillGapData && (
                <Card className="border border-indigo-100 bg-white shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4 text-white" />
                        <h3 className="text-sm font-bold text-white">Skill Gap Dashboard</h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-white">{skillGapData.matchPercentage}%</div>
                          <div className="text-xs text-indigo-200">Current Match</div>
                        </div>
                        {skillGapData.predictedScore !== null && skillGapData.predictedScore > skillGapData.matchPercentage && (
                          <div className="text-right border-l border-indigo-400 pl-3">
                            <div className="text-2xl font-bold text-emerald-300">{skillGapData.predictedScore}%</div>
                            <div className="text-xs text-indigo-200">After Fix</div>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Match bar */}
                    <div className="mt-3">
                      <div className="w-full bg-indigo-800/50 rounded-full h-1.5">
                        <div
                          className="bg-white h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${skillGapData.matchPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-5 space-y-5">

                    {/* Auto-fix result banner */}
                    {autoFixResult && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-emerald-800 mb-1">✅ Auto-Fix Applied</p>
                        <p className="text-xs text-emerald-700">
                          Score: <strong>{autoFixResult.scoreBefore}</strong> → <strong>{autoFixResult.scoreAfter}</strong>
                        </p>
                        {autoFixResult.added.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {autoFixResult.added.map(k => (
                              <span key={k} className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs rounded">{k}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Matched Skills */}
                    {skillGapData.matchedSkills.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2.5 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Matched ({skillGapData.matchedCount})
                        </p>
                        <div className="space-y-2">
                          {skillGapData.matchedSkills.map(sk => (
                            <div key={sk.keyword} className="flex items-center justify-between gap-2 p-2 bg-green-50 border border-green-100 rounded-lg">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-medium text-green-800 truncate">{sk.keyword}</span>
                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  sk.matchType === 'exact' ? 'bg-green-200 text-green-800' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {sk.matchType}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {sk.sections.slice(0, 2).map(s => (
                                  <span key={s} className="px-1 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded">{s}</span>
                                ))}
                                <span className="text-[10px] text-gray-400">×{sk.frequency}</span>
                                {/* Confidence bar */}
                                <div className="w-10 bg-gray-200 rounded-full h-1">
                                  <div className="bg-green-500 h-1 rounded-full" style={{ width: `${sk.confidence * 100}%` }} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing Skills */}
                    {skillGapData.missingSkills.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2.5 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Missing ({skillGapData.missingCount})
                        </p>

                        {/* Core Technical */}
                        {skillGapData.missingSkills.filter(s => s.type === 'hard').length > 0 && (
                          <div className="mb-3">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Core Technical</p>
                            <div className="flex flex-wrap gap-1.5">
                              {skillGapData.missingSkills.filter(s => s.type === 'hard').map(sk => (
                                <span key={sk.keyword} className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded border border-red-200 font-medium">
                                  {sk.keyword}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Optional / Contextual */}
                        {skillGapData.missingSkills.filter(s => s.type === 'context').length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1.5">Contextual / Optional</p>
                            <div className="flex flex-wrap gap-1.5">
                              {skillGapData.missingSkills.filter(s => s.type === 'context').map(sk => (
                                <span key={sk.keyword} className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded border border-orange-200">
                                  {sk.keyword}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Auto Fix Button */}
                    {skillGapData.missingSkills.length > 0 && (
                      <button
                        onClick={handleAutoFix}
                        disabled={isAutoFixing}
                        className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                      >
                        {isAutoFixing
                          ? <><Loader className="w-4 h-4 animate-spin" /> Fixing…</>
                          : <><Zap className="w-4 h-4" /> Auto Fix Resume</>}
                      </button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* AI Analysis Card */}
              {overallFeedback && (
                (overallFeedback.strengths?.length ?? 0) > 0 || (overallFeedback.weaknesses?.length ?? 0) > 0
              ) && (
                <Card className="border border-gray-200">
                  <CardContent className="p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-500" />
                      AI Analysis
                    </h3>

                    {overallFeedback.strengths.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">✓ Strengths</p>
                        <ul className="space-y-1.5">
                          {overallFeedback.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                              <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {overallFeedback.weaknesses.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">✗ Needs Work</p>
                        <ul className="space-y-1.5">
                          {overallFeedback.weaknesses.map((w, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {overallFeedback.recommendations?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Recommendations</p>
                        <ul className="space-y-1.5">
                          {overallFeedback.recommendations.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                              <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ── Right Column: Suggestions ──────────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">

              {missingKeywords.length > 0 && (
                <Card className="border-l-4 border-l-yellow-500 bg-yellow-50 border border-yellow-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                          {missingKeywords.length} Keyword{missingKeywords.length !== 1 ? "s" : ""} Missing from Your Resume
                        </h3>
                        <p className="text-xs text-yellow-800">
                          Adding these keywords can significantly boost your ATS match rate.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Improvement Suggestions</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {suggestions.length} total · sorted by impact
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  {(["all", "high", "medium", "low"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        activeFilter === f
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)} ({impactCounts[f]})
                    </button>
                  ))}
                </div>
              </div>

              {/* Suggestions List */}
              {filteredSuggestions.length === 0 ? (
                shouldShowNoSuggestionsPlaceholder ? (
                  <Card className="border border-gray-200 bg-green-50">
                    <CardContent className="p-10 text-center">
                      <CheckCircle className="w-14 h-14 text-green-600 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Suggestions!</h3>
                      <p className="text-sm text-gray-600">Your resume is well-optimized. Great job!</p>
                    </CardContent>
                  </Card>
                ) : null
              ) : (
                <div className="space-y-4">
                  {filteredSuggestions.map(suggestion => {
                    const impact   = safeImpact(suggestion.impact);
                    const cfg      = impactConfig[impact];
                    const applying = isApplying === suggestion.id || isApplying === "all";

                    return (
                      <Card
                        key={suggestion.id}
                        className="border border-gray-200 hover:border-indigo-200 transition-colors"
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label} IMPACT
                              </div>
                              <h3 className="font-semibold text-gray-900 text-sm leading-snug">
                                {suggestion.reason || suggestion.improvedText.slice(0, 70)}
                              </h3>
                            </div>

                            <Button
                              size="sm"
                              className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-xs"
                              onClick={() => applySuggestion(suggestion)}
                              disabled={isApplying !== null}
                            >
                              {applying
                                ? <><Loader className="w-3 h-3 mr-1 animate-spin" />Applying…</>
                                : "Apply Fix"}
                            </Button>
                          </div>

                          {/* Section badge */}
                          <div className="mb-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                              <FileText className="w-3 h-3" />
                              {suggestion.section}
                            </span>
                          </div>

                          {/* Current / Improved text */}
                          {(suggestion.currentText || suggestion.improvedText) && (
                            <div className="grid sm:grid-cols-2 gap-3">
                              {suggestion.currentText && (
                                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-red-700 mb-1.5 uppercase">Current Text</p>
                                  <p className="text-xs text-gray-700 leading-relaxed line-clamp-4">
                                    {suggestion.currentText}
                                  </p>
                                </div>
                              )}
                              {suggestion.improvedText && (
                                <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-green-700 mb-1.5 uppercase">Improved Text</p>
                                  <p className="text-xs text-gray-700 leading-relaxed line-clamp-4">
                                    {suggestion.improvedText}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── AI Rewrite Modal ──────────────────────────────────────────────── */}
      {aiPreview && rewriteResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border-0">
            <CardContent className="p-0">

              {/* Modal Header */}
              <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 rounded-t-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">AI Rewrite Ready</h2>
                    <p className="text-violet-200 text-sm mt-0.5">Review changes before applying. Toggle sections on/off.</p>
                  </div>
                </div>

                {/* Score Delta Banner */}
                {rewriteResult.originalScore != null && rewriteResult.newScore != null && (
                  <div className="mt-4 bg-white/15 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{rewriteResult.originalScore}</div>
                      <div className="text-xs text-violet-200">Current Score</div>
                    </div>
                    <ArrowRight className="w-6 h-6 text-violet-300" />
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-300">{rewriteResult.newScore}</div>
                      <div className="text-xs text-violet-200">Projected Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-300">+{rewriteResult.scoreDelta}</div>
                      <div className="text-xs text-violet-200">Score Boost</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-5">

                {/* Improvements List */}
                {rewriteResult.improvements?.length > 0 && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">What was improved</p>
                    <ul className="space-y-1.5">
                      {rewriteResult.improvements.map((imp: string, i: number) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-indigo-800">
                          <CheckCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          {imp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Summary Diff */}
                {aiPreview.summary && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-semibold text-gray-800">Summary</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiApplySections.summary}
                          onChange={e => setAiApplySections(p => ({ ...p, summary: e.target.checked }))}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        <span className="text-xs text-gray-500">Apply</span>
                      </label>
                    </div>
                    <div className="grid sm:grid-cols-2 divide-x divide-gray-100">
                      <div className="p-4">
                        <p className="text-[10px] font-semibold text-red-600 uppercase mb-1.5">Before</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{aiPreview.summary.before || '—'}</p>
                      </div>
                      <div className="p-4 bg-green-50/40">
                        <p className="text-[10px] font-semibold text-green-600 uppercase mb-1.5">After</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{aiPreview.summary.after || '—'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Project Diffs */}
                {aiPreview.projects?.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-semibold text-gray-800">Projects ({aiPreview.projects.length})</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiApplySections.projects}
                          onChange={e => setAiApplySections(p => ({ ...p, projects: e.target.checked }))}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        <span className="text-xs text-gray-500">Apply</span>
                      </label>
                    </div>
                    <div className="p-4 space-y-4">
                      {aiPreview.projects.map((proj: any, i: number) => (
                        <div key={i}>
                          <p className="text-xs font-semibold text-gray-700 mb-2">{proj.title}</p>
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] font-semibold text-red-600 uppercase mb-1">Before</p>
                              <ul className="space-y-0.5">
                                {(proj.before || []).map((b: string, j: number) => (
                                  <li key={j} className="text-[11px] text-gray-500 leading-relaxed">• {b}</li>
                                ))}
                                {!proj.before?.length && <li className="text-[11px] text-gray-400 italic">No bullets</li>}
                              </ul>
                            </div>
                            <div className="bg-green-50/40 rounded-lg p-2">
                              <p className="text-[10px] font-semibold text-green-600 uppercase mb-1">After</p>
                              <ul className="space-y-0.5">
                                {(proj.after || []).map((b: string, j: number) => (
                                  <li key={j} className="text-[11px] text-gray-700 leading-relaxed">• {b}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills Added */}
                {aiPreview.skills?.added?.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-semibold text-gray-800">Skills to Add ({aiPreview.skills.added.length})</span>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aiApplySections.skills}
                          onChange={e => setAiApplySections(p => ({ ...p, skills: e.target.checked }))}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        <span className="text-xs text-gray-500">Apply</span>
                      </label>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {aiPreview.skills.added.map((sk: string) => (
                          <span key={sk} className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-medium">
                            + {sk}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {rewriteResult.isFallback && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    ⚠️ AI is temporarily busy — these are offline suggestions. Full AI rewrite will be available shortly.
                  </p>
                )}

              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 px-6 pb-6">
                <Button variant="outline" onClick={() => { setAiPreview(null); setRewriteResult(null); }}>Discard</Button>
                <Button
                  onClick={applyAIImprovements}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Apply Selected Sections
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}