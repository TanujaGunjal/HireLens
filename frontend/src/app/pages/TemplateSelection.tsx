import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ChevronLeft, CheckCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../contexts/AuthContext";
import { resumeAPI } from "../services/api";
import { toast } from "sonner";

// ✅ Template metadata - NO hardcoded ATS scores
// ATS score is determined by resume content + JD match, NOT by template
const templates = [
  {
    id: "classic",
    name: "Classic Professional",
    description: "Traditional layout perfect for corporate roles",
    badge: "Popular",
    isATS: true,
    isSingleColumn: true,
    preview: "/preview-classic.png",
  },
  {
    id: "fresher",
    name: "Fresher Clean",
    description: "Modern design for entry-level candidates",
    badge: "New",
    isATS: true,
    isSingleColumn: true,
    preview: "/preview-fresher.png",
  },
  {
    id: "tech",
    name: "Experienced Tech",
    description: "Tech-focused layout for senior professionals",
    badge: "Tech-Focused",
    isATS: true,
    isSingleColumn: true,
    preview: "/preview-tech.png",
  },
];

// ✅ Template Preview Component - Shows real mini resume preview
const TemplatePreview = ({ templateId }: { templateId: string }) => {
  const getStyleVariant = (id: string) => {
    switch (id) {
      case "classic":
        return {
          spacing: "space-y-2.5",
          headerStyle: "text-center border-b-2 border-gray-400 pb-2.5",
          nameSize: "text-sm font-bold",
          titleSize: "text-xs text-gray-600",
          sectionTitleStyle: "text-xs font-bold text-gray-800 uppercase tracking-wide",
        };
      case "fresher":
        return {
          spacing: "space-y-2",
          headerStyle: "pb-2 border-b border-gray-300",
          nameSize: "text-sm font-bold",
          titleSize: "text-xs text-gray-600",
          sectionTitleStyle: "text-xs font-semibold text-indigo-600",
        };
      case "tech":
        return {
          spacing: "space-y-2.5",
          headerStyle: "pb-2.5 border-b-2 border-gray-800 bg-gray-100 -mx-3 -mt-3 px-3 py-2",
          nameSize: "text-sm font-bold text-gray-900",
          titleSize: "text-xs text-gray-700 font-semibold",
          sectionTitleStyle: "text-xs font-bold text-gray-900 bg-yellow-100 inline-block px-2 py-0.5 rounded",
        };
      default:
        return {
          spacing: "space-y-2.5",
          headerStyle: "text-center pb-2.5",
          nameSize: "text-sm font-bold",
          titleSize: "text-xs text-gray-600",
          sectionTitleStyle: "text-xs font-bold",
        };
    }
  };

  const style = getStyleVariant(templateId);

  return (
    <div className="p-3 bg-white h-full flex flex-col overflow-hidden">
      <div className={`${style.spacing} text-gray-700 flex-1`}>
        {/* Header - Name and Title */}
        <div className={style.headerStyle}>
          <h3 className={style.nameSize}>Alex Johnson</h3>
          <p className={style.titleSize}>Product Manager</p>
          {templateId === "tech" && (
            <p className="text-xs text-gray-600 mt-1">San Francisco, CA • alex@email.com</p>
          )}
        </div>

        {/* Summary Section */}
        <div>
          <p className={style.sectionTitleStyle}>Summary</p>
          <p className="text-xs text-gray-600 leading-tight mt-1">
            {templateId === "fresher"
              ? "Entry-level PM with internship experience and product mindset."
              : "Results-driven PM with 5+ years scaling B2B products."}
          </p>
        </div>

        {/* Skills Section */}
        <div>
          <p className={style.sectionTitleStyle}>Skills</p>
          {templateId === "fresher" ? (
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Analytics</span>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">SQL</span>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">Figma</span>
            </div>
          ) : (
            <p className="text-xs text-gray-600 mt-1 leading-tight">
              {templateId === "tech"
                ? "Python • AWS • Docker • Kubernetes • CI/CD"
                : "Product Strategy • Data Analysis • Stakeholder Mgmt • Agile"}
            </p>
          )}
        </div>

        {/* Experience Section */}
        <div>
          <p className={style.sectionTitleStyle}>Experience</p>
          <div className="text-xs space-y-1 mt-1">
            {templateId === "tech" ? (
              <>
                <div>
                  <p className="font-semibold text-gray-800">Senior Engineer • Tech Corp</p>
                  <p className="text-gray-600">Led infrastructure ↪ 40% latency reduction</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="font-semibold text-gray-800">Product Manager • Global Inc</p>
                  <p className="text-gray-600">Grew user base by 120% YoY</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function TemplateSelection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  // Read resumeId from query parameter
  const resumeId = searchParams.get("id");
  
  // ✅ Use string IDs for templates (matching template.id)
  const [selectedTemplate, setSelectedTemplate] = useState<string>("classic");
  const [atsScore, setAtsScore] = useState<number | null>(null);
  const [isLoadingScore, setIsLoadingScore] = useState(false);

  // ✅ Load saved template preference from localStorage on mount
  useEffect(() => {
    const savedTemplate = localStorage.getItem("selectedTemplate");
    if (savedTemplate && templates.some(t => t.id === savedTemplate)) {
      setSelectedTemplate(savedTemplate);
    }
  }, []);

  // ✅ Persist template selection to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("selectedTemplate", selectedTemplate);
    console.log(`📋 Template persisted: ${selectedTemplate}`);
  }, [selectedTemplate]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, authLoading, navigate]);

  // ✅ Load ATS score from resume if resumeId is available
  useEffect(() => {
    if (!resumeId) return;

    const loadAtsScore = async () => {
      try {
        setIsLoadingScore(true);
        const resumeResponse = await resumeAPI.getResumeById(resumeId);
        const score = resumeResponse?.data?.atsScore;
        if (score !== null && score !== undefined) {
          setAtsScore(score);
        }
      } catch (error) {
        console.warn("Failed to load ATS score:", error);
        // Continue anyway - ATS score is optional for template selection
      } finally {
        setIsLoadingScore(false);
      }
    };

    loadAtsScore();
  }, [resumeId]);

  // \u2705 Template selection is ONLY for layout - saves templateId to resume
  const handleTemplateSelect = async (templateId: string) => {
    setSelectedTemplate(templateId);
    
    // \u2705 Save templateId to resume if we have a resumeId
    if (resumeId) {
      try {
        await resumeAPI.updateResume(resumeId, { templateId });
        console.log(`🎨 Template selected and saved: ${templateId}`);
        toast.success(`Template changed to ${templateId}`);
      } catch (error) {
        console.error('Failed to save template selection:', error);
        toast.error('Failed to save template selection');
      }
    } else {
      console.log(`🎨 Template selected (local only): ${templateId}`);
    }
  };

  // Handle Continue to Download (only if resumeId present)
  const handleContinueToDownload = () => {
    if (!resumeId) {
      toast.error("Resume ID not found. Please select a resume from your dashboard.");
      navigate("/dashboard");
      return;
    }

    console.log("🆔 resumeId:", resumeId);
    console.log("🎨 selectedTemplate:", selectedTemplate);
    console.log("🌐 Navigating to:", `/download?id=${resumeId}&template=${selectedTemplate}`);
    
    navigate(`/download?id=${encodeURIComponent(resumeId)}&template=${selectedTemplate}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-['Inter']">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  Back
                </Button>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Choose Template</h1>
            </div>
            {resumeId ? (
              <Button
                onClick={handleContinueToDownload}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Continue to Download
              </Button>
            ) : (
              <Link to="/dashboard">
                <Button variant="outline">
                  Back to Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Select Your Resume Template
          </h2>
          <p className="text-gray-600">
            All templates are ATS-friendly and professionally designed
          </p>

          {/* ✅ Display single ATS score (not per-template) */}
          {atsScore !== null && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg inline-block">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-900">
                  ATS Score: {atsScore}/100
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Templates Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {templates.map((template) => (
            <Card
              key={template.id}
              className={`border-2 cursor-pointer transition-all duration-200 hover:shadow-xl hover:scale-105 ${
                selectedTemplate === template.id
                  ? "border-indigo-600 shadow-lg bg-indigo-50"
                  : "border-gray-200 hover:border-indigo-300"
              }`}
              onClick={() => handleTemplateSelect(template.id)}
            >
              <CardContent className="p-0">
                {/* ✅ Template Preview - Shows actual layout */}
                <div className="relative bg-gray-50 aspect-[8.5/11] rounded-t-lg overflow-hidden border-b border-gray-200">
                  <TemplatePreview templateId={template.id} />

                  {/* Selected Indicator */}
                  {selectedTemplate === template.id && (
                    <div className="absolute top-3 right-3 bg-indigo-600 rounded-full p-1 shadow-lg">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  )}

                  {/* Badge (Popular, New, or Tech-Focused) */}
                  {template.badge && (
                    <div className="absolute top-3 left-3">
                      <Badge 
                        className={`text-white hover:opacity-90 shadow ${
                          template.badge === "Popular" ? "bg-yellow-500 hover:bg-yellow-600" :
                          template.badge === "New" ? "bg-blue-500 hover:bg-blue-600" :
                          "bg-purple-500 hover:bg-purple-600"
                        }`}
                      >
                        {template.badge}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Template Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  
                  {/* ✅ ATS-friendly badges */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {template.isATS && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-50 rounded-full border border-green-200">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span className="text-xs text-green-700 font-medium">ATS Friendly</span>
                      </div>
                    )}
                    {template.isSingleColumn && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full border border-blue-200">
                        <CheckCircle className="w-3 h-3 text-blue-600" />
                        <span className="text-xs text-blue-700 font-medium">Single Column</span>
                      </div>
                    )}
                  </div>
                  
                  {/* ✅ Single ATS score for all templates */}
                  {atsScore !== null && (
                    <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200">
                      <span className="text-xs text-gray-600">This Resume: </span>
                      <span className="text-sm font-bold text-green-600">{atsScore}/100</span>
                    </div>
                  )}

                  {/* ✅ Enhanced Select button with better states */}
                  <div className="flex gap-2">
                    {selectedTemplate === template.id ? (
                      <div className="flex-1 flex items-center justify-center px-3 py-2 bg-indigo-600 text-white rounded-md font-medium text-sm">
                        <CheckCircle className="w-4 h-4 mr-1.5" />
                        Selected
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        className="flex-1 border-indigo-200 hover:bg-indigo-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTemplateSelect(template.id);
                        }}
                      >
                        Select
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Template Features */}
        <div className="mt-12">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            All Templates Include
          </h3>
          <div className="grid md:grid-cols-4 gap-6">
            <Card className="border border-gray-200">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">ATS-Optimized</h4>
                <p className="text-sm text-gray-600">
                  Designed to pass all ATS systems
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Clean Layout</h4>
                <p className="text-sm text-gray-600">
                  Professional and easy to read
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">PDF Export</h4>
                <p className="text-sm text-gray-600">
                  High-quality PDF output
                </p>
              </CardContent>
            </Card>

            <Card className="border border-gray-200">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-6 h-6 text-indigo-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Customizable</h4>
                <p className="text-sm text-gray-600">
                  Easy to modify and personalize
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
