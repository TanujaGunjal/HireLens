import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router";
import { ChevronLeft, Download, FileText, Loader, CheckCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { resumeAPI } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import ResumeRenderer from "../components/resume/ResumeRenderer";
import { toast } from "sonner";

// Template options
const TEMPLATE_OPTIONS = [
  { id: "classic", name: "Classic Professional", description: "Traditional corporate layout" },
  { id: "fresher", name: "Fresher Clean", description: "Modern design for entry-level" },
  { id: "tech", name: "Experienced Tech", description: "Tech-focused layout" },
];

interface Resume {
  _id?: string;
  resumeTitle: string;
  templateId?: string;
  personalInfo: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github?: string;
    portfolio?: string;
  };
  summary: string;
  skills: Array<{
    category: string;
    items: string[];
  }>;
  experience: Array<{
    role: string;
    company: string;
    startDate: string;
    endDate: string;
    location?: string;
    bullets: string[];
    current?: boolean;
  }>;
  projects: Array<{
    title: string;
    techStack: string[];
    description?: string;
    bullets: string[];
    link?: string;
  }>;
  education: Array<{
    degree: string;
    field?: string;
    institution: string;
    endDate?: string;
    location?: string;
    grade?: string;
  }>;
  certifications?: Array<{
    name: string;
    issuer?: string;
    date?: string;
  }>;
  achievements?: string[];
  languages?: Array<{
    name: string;
    proficiency: string;
  }>;
}

export default function DownloadResume() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const resumeId = searchParams.get("id");

  const [resume, setResume] = useState<Resume | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isChangingTemplate, setIsChangingTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("classic");

  // Helper function to check if achievements have valid content
  const hasValidAchievements = (resume: Resume | null): boolean => {
    if (!resume?.achievements) return false;
    if (!Array.isArray(resume.achievements)) return false;
    return resume.achievements.some((item) => {
      if (typeof item === "string") return item.trim().length > 0;
      if (typeof item === "object" && item !== null)
        return Object.values(item).some(
          (v) => typeof v === "string" && v.trim().length > 0
        );
      return false;
    });
  };

  // Helper function to get achievement text from various formats
  const getAchievementText = (item: string | object): string | undefined => {
    if (typeof item === "string") return item.trim() || undefined;
    if (typeof item === "object" && item !== null) {
      return Object.values(item).find(
        (v) => typeof v === "string" && v.trim().length > 0
      );
    }
    return undefined;
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (resumeId && isAuthenticated) {
      loadResume(resumeId);
    } else if (isAuthenticated && !resumeId) {
      toast.error("Resume ID not found");
      navigate("/dashboard");
    }
  }, [resumeId, isAuthenticated]);

  const loadResume = async (id: string) => {
    try {
      setIsLoading(true);
      const response = await resumeAPI.getResumeById(id);
      
      if (!response?.data) {
        toast.error("Resume not found");
        navigate("/dashboard");
        return;
      }
      
      const resumeData = response.data as Resume;
      setResume(resumeData);
      
      console.log(`%c[DownloadResume] Resume Loaded`, 'color: green; font-weight: bold');
      console.log(`  Resume ID: ${resumeData._id}`);
      console.log(`  templateId from DB: "${resumeData.templateId}"`);
      console.log(`  Setting selectedTemplate to: "${resumeData.templateId || 'classic'}"`);
      
      setSelectedTemplate(resumeData.templateId || "classic");
    } catch (error) {
      console.error("Failed to load resume:", error);
      toast.error("Failed to load resume");
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle template change
  const handleTemplateChange = async (templateId: string) => {
    if (!resumeId) return;

    try {
      console.log(`%c[DownloadResume] Changing template to: "${templateId}"`, 'color: blue; font-weight: bold');
      
      setIsChangingTemplate(true);
      await resumeAPI.updateTemplate(resumeId, templateId);
      
      console.log(`%c✅ Template changed in DB`, 'color: green; font-weight: bold');
      console.log(`  Resume ID: ${resumeId}`);
      console.log(`  New template: "${templateId}"`);
      
      setSelectedTemplate(templateId);
      
      // Update resume object locally to reflect template change
      if (resume) {
        setResume({ ...resume, templateId });
        console.log(`  Local state updated`);
      }
      
      toast.success(`Template changed to ${templateId}`);
    } catch (error) {
      console.error("Failed to change template:", error);
      toast.error("Failed to change template");
    } finally {
      setIsChangingTemplate(false);
    }
  };

  // Debug: Log template changes
  useEffect(() => {
    console.log(`%c[DownloadResume] Current State:`, 'color: purple; font-weight: bold');
    console.log(`  selectedTemplate: "${selectedTemplate}"`);
    console.log(`  resume.templateId: "${resume?.templateId}"`);
    console.log(`  Resume data available: ${!!resume}`);
  }, [selectedTemplate, resume]);

  const handleDownload = async () => {
    if (!resumeId) return;

    try {
      setIsDownloading(true);
      
      // Log current state
      console.log(`[Frontend] ========= DOWNLOAD INITIATED ==========`);
      console.log(`[Frontend] Resume ID: ${resumeId}`);
      console.log(`[Frontend] Selected Template (UI state): "${selectedTemplate}"`);
      console.log(`[Frontend] Resume in state has template: "${resume?.templateId}"`);
      
      // Refresh resume data to ensure we have the latest template from database
      const freshResponse = await resumeAPI.getResumeById(resumeId);
      if (freshResponse?.data) {
        const freshResume = freshResponse.data as Resume;
        console.log(`[Frontend] Fresh fetch from DB: template = "${freshResume.templateId}"`);
        
        // Verify the template matches what we expect
        if (freshResume.templateId !== selectedTemplate) {
          console.warn(`[Frontend] ⚠️  Template mismatch detected!`);
          console.warn(`  - UI state: "${selectedTemplate}"`);
          console.warn(`  - DB value: "${freshResume.templateId}"`);
          console.warn(`  - Using DB version for PDF generation`);
          setSelectedTemplate(freshResume.templateId || "classic");
        } else {
          console.log(`[Frontend] ✅ Template match verified: "${selectedTemplate}"`);
        }
      }
      
      // Now download with the confirmed template
      console.log(`[Frontend] ✅ About to download PDF with template: "${selectedTemplate}"`);
      const blob = await resumeAPI.downloadPDF(resumeId);

      const name = resume?.personalInfo?.fullName?.replace(/\s+/g, '_') || 'Resume';
      const filename = `B2World_Resume_${name}.pdf`;

      console.log(`[Frontend] ✅ PDF received (${blob.size} bytes)`);
      console.log(`[Frontend] Filename: ${filename}`);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log(`[Frontend] ========= DOWNLOAD COMPLETE ===========\n`);
      toast.success('Resume downloaded successfully!');
    } catch (error: any) {
      console.error('❌ Download error:', error);
      toast.error(error?.message || 'Failed to download resume. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading || !resume) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading resume...</p>
        </div>
      </div>
    );
  }

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
                  Back to Dashboard
                </Button>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Download Resume</h1>
            </div>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              <Download className="w-4 h-4 mr-2" />
              {isDownloading ? "Downloading..." : "Download as PDF"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Preview */}
          <div>
            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Resume Preview</h2>

              {/* ✅ Use ResumeRenderer to display the correct template */}
                <ResumeRenderer 
                  templateId={selectedTemplate} 
                  data={resume}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Options */}
          <div className="space-y-6">
            {/* Template Selection */}
            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose Template</h2>
                <div className="space-y-2">
                  {TEMPLATE_OPTIONS.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateChange(template.id)}
                      disabled={isChangingTemplate}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        selectedTemplate === template.id
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      } ${isChangingTemplate ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{template.name}</div>
                          <div className="text-xs text-gray-500">{template.description}</div>
                        </div>
                        {selectedTemplate === template.id && (
                          <CheckCircle className="w-5 h-5 text-indigo-600" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Format Selection */}
            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Download Options</h2>
                <div className="space-y-3">
                  <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="w-full flex items-center gap-4 p-4 border-2 border-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    <div className="bg-indigo-100 p-3 rounded-lg">
                      <FileText className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="font-semibold text-gray-900">Download as PDF</h3>
                      <p className="text-sm text-gray-600">High quality PDF format</p>
                    </div>
                    <Download className="w-5 h-5 text-indigo-600" />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Document Info */}
            <Card className="border border-gray-200">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Document Info</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Resume Title:</span>
                    <span className="font-semibold text-gray-900">{resume?.resumeTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Full Name:</span>
                    <span className="font-semibold text-gray-900">{resume?.personalInfo?.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Email:</span>
                    <span className="font-semibold text-gray-900 text-sm">{resume?.personalInfo?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Skills:</span>
                    <span className="font-semibold text-gray-900">
                      {resume?.skills?.reduce((total, group) => total + (group.items?.length || 0), 0) || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Experience:</span>
                    <span className="font-semibold text-gray-900">{Array.isArray(resume?.experience) ? resume.experience.length : 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="border border-indigo-200 bg-indigo-50">
              <CardContent className="p-6">
                <h3 className="font-semibold text-indigo-900 mb-3">Tips for Downloading</h3>
                <ul className="space-y-2 text-sm text-indigo-800">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600">•</span>
                    <span>Download as PDF to preserve formatting</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600">•</span>
                    <span>Give your file a professional name before uploading</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600">•</span>
                    <span>Ensure your file size is under 5MB</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-600">•</span>
                    <span>Always verify content before sending to employers</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
