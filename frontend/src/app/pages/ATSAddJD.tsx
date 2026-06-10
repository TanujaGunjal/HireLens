import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ChevronLeft, Loader, Target } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { useAuth } from "../contexts/AuthContext";
import { jdAPI, atsAPI } from "../services/api";
import { toast } from "sonner";

export default function ATSAddJD() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const resumeId = searchParams.get("id")?.trim() || "";
  const [jdText, setJdText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<"idle" | "analyze" | "link">("idle");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/auth");
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (!resumeId) {
      toast.error("Missing resume ID");
      navigate("/dashboard");
    }
  }, [resumeId, navigate]);

  const handleSaveJD = async () => {
    if (!resumeId) {
      toast.error("Missing resume ID");
      return;
    }
    
    if (jdText.trim().length < 50) {
      toast.error("Please paste a valid Job Description (min 50 chars).");
      return;
    }

    try {
      setIsProcessing(true);
      setCurrentStep("analyze");

      // Step 1: Analyze JD
      console.log("🔵 ATSAddJD: Step 1 - Analyzing JD with resumeId:", resumeId);
      const jdResult = await jdAPI.analyzeJD(jdText, resumeId);
      console.log("✅ ATSAddJD: JD analyzed, jdId received:", jdResult?.data?.jdId);
      
      if (!jdResult?.data?.jdId) {
        console.error("❌ ATSAddJD: No jdId in response:", jdResult);
        throw new Error("Server did not return Job Description ID. Please try again.");
      }

      // Step 2: Calculate ATS Score (frontend calculates, backend ensures jdId is linked)
      setCurrentStep("score");
      console.log("🔵 ATSAddJD: Step 2 - Calculating ATS Score with resumeId:", resumeId);
      
      const scoreResult = await atsAPI.calculateScore(resumeId);
      console.log("✅ ATSAddJD: Score endpoint returned:", scoreResult);

      // Step 3: Navigate to ATS Score page
      console.log("✅ ATSAddJD: Flow complete, navigating to ATS Score page");
      const targetUrl = `/ats-score?id=${resumeId}&fresh=true`;
      
      // Add small delay to ensure backend writes are flushed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      navigate(targetUrl, { replace: false });
      toast.success("Job Description added successfully!");
      
    } catch (error: any) {
      console.error("🔥 ATSAddJD Error:", error?.message || error);
      const errorMsg = error?.message || "Failed to process Job Description. Please try again.";
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
      setCurrentStep("idle");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to={`/ats-score?id=${resumeId}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Back to ATS Score</span>
              </Link>
              <div className="w-px h-5 bg-gray-300" />
              <h1 className="text-lg font-semibold text-gray-900">Add Job Description</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-indigo-600" />
              <h2 className="text-base font-semibold text-gray-900">Job Description for ATS Scoring</h2>
            </div>

            <Textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={14}
              placeholder="Paste the full Job Description here..."
              className="resize-none"
              disabled={isProcessing}
            />

            {/* Progress indicator */}
            {isProcessing && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800 flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                <span>
                  {currentStep === "analyze" && "Analyzing Job Description..."}
                  {currentStep === "score" && "Calculating ATS Score..."}
                </span>
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <Link to={`/ats-score?id=${resumeId}`}>
                <Button variant="outline" disabled={isProcessing}>
                  Cancel
                </Button>
              </Link>
              <Button onClick={handleSaveJD} disabled={isProcessing || !jdText.trim()}>
                {isProcessing ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Save & Continue"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
