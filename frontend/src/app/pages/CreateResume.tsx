import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { FileText, ChevronLeft, Plus, Trash2, Save, Loader, CheckCircle, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { resumeAPI } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import { transformToBackend, transformFromBackend } from "../services/dataTransformer";

const steps = [
  "Personal Info",
  "Summary",
  "Skills",
  "Experience",
  "Projects",
  "Education",
  "Certifications",
  "Achievements",
  "Review",
];

interface ResumeData {
  _id?: string;
  resumeTitle: string;
  personalInfo: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github: string;
    portfolio: string;
  };
  summary: string;
  skills: string[];
  experience: Array<{
    id: string;
    jobTitle: string;
    company: string;
    startDate: string;
    endDate: string;
    isPresent?: boolean;
    description: string;
  }>;
  projects: Array<{
    id: string;
    name: string;
    technologies: string;
    description: string;
    link: string;
  }>;
  education: Array<{
    id: string;
    degree: string;
    institution: string;
    graduationYear: string;
    gpa: string;
  }>;
  certifications: Array<{
    id: string;
    name: string;
    organization: string;
    issueDate: string;
    expiryDate: string;
    credentialId: string;
  }>;
  /** Free-text achievements — each line is one achievement bullet */
  achievementsText: string;
}

export default function CreateResume() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const resumeId = searchParams.get("id");

  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(!!resumeId);
  const [isSaving, setIsSaving] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<ResumeData>({
    resumeTitle: "",
    personalInfo: {
      fullName: user?.name || "",
      email: user?.email || "",
      phone: "",
      location: "",
      linkedin: "",
      github: "",
      portfolio: "",
    },
    summary: "",
    skills: [],
    experience: [{ id: "1", jobTitle: "", company: "", startDate: "", endDate: "", isPresent: false, description: "" }],
    projects: [{ id: "1", name: "", technologies: "", description: "", link: "" }],
    education: [{ id: "1", degree: "", institution: "", graduationYear: "", gpa: "" }],
    certifications: [{ id: "1", name: "", organization: "", issueDate: "", expiryDate: "", credentialId: "" }],
    achievementsText: "",
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Load existing resume if editing
  useEffect(() => {
    if (resumeId && isAuthenticated) {
      loadResume(resumeId);
    }
  }, [resumeId, isAuthenticated]);

  const loadResume = async (id: string) => {
    try {
      const response = await resumeAPI.getResumeById(id);
      const backendResume = response?.data;
      
      if (!backendResume) {
        toast.error("Resume not found");
        setIsLoading(false);
        return;
      }
      
      // CRITICAL: Transform backend data to frontend format
      const frontendResume = transformFromBackend(backendResume);
      setFormData(frontendResume);
      setIsLoading(false);
      toast.success("Resume loaded successfully");
    } catch (error) {
      console.error("❌ Failed to load resume:", error);
      toast.error("Failed to load resume");
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File is too large. Max size is 2MB.");
      return;
    }

    try {
      setIsUploading(true);
      const res = await resumeAPI.uploadResume(file);
      if (res.success && res.data?.parsedResume) {
        setPreviewData(res.data.parsedResume);
      } else {
        toast.error("Failed to parse resume");
      }
    } catch (error: any) {
      toast.error(error.message || "Error uploading resume");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const applyParsedData = () => {
    if (!previewData) return;
    
    setFormData(prev => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        fullName: previewData.personalInfo?.fullName || prev.personalInfo.fullName,
        email: previewData.personalInfo?.email || prev.personalInfo.email,
        phone: previewData.personalInfo?.phone || prev.personalInfo.phone,
      },
      summary: previewData.summary || prev.summary,
      skills: previewData.skills?.length > 0 ? previewData.skills : prev.skills,
      experience: previewData.experience?.length > 0 ? previewData.experience : prev.experience,
      education: previewData.education?.length > 0 ? previewData.education : prev.education,
      projects: previewData.projects?.length > 0 ? previewData.projects : prev.projects,
      certifications: previewData.certifications?.length > 0 
        ? previewData.certifications.map((c: any) => ({
            id: c.id,
            name: c.title || "",
            organization: "",
            issueDate: "",
            expiryDate: "",
            credentialId: ""
          }))
        : prev.certifications,
      achievementsText: previewData.achievements?.length > 0
        ? previewData.achievements.map((a: any) => a.title).join("\n")
        : prev.achievementsText,
    }));
    
    setPreviewData(null);
    toast.success("Resume data loaded successfully! Please review each section.");
  };

  const saveResume = async () => {
    try {
      const { errors, warnings } = validateExperienceDates(formData.experience);
      if (errors.length > 0) {
        toast.error(errors[0]);
        return;
      }
      if (warnings.length > 0) {
        toast.warning(warnings[0]);
      }

      setIsSaving(true);
      
      // CRITICAL: Transform frontend format to backend format before API call
      const backendPayload = transformToBackend({
        ...formData,
        experience: formData.experience.map((exp) => ({
          ...exp,
          startDate: normalizeMonthValue(exp.startDate),
          endDate: exp.isPresent ? "" : normalizeMonthValue(exp.endDate),
        })),
      });

      if (formData._id) {
        // Update existing resume
        await resumeAPI.updateResume(formData._id, backendPayload);
        toast.success("Resume saved successfully");
      } else {
        // Create new resume
        const response = await resumeAPI.createResume(backendPayload);
        const newId = response?.data?.resume?._id;
        if (newId) {
          setFormData(prev => ({ ...prev, _id: newId }));
          console.log("✅ Resume created with ID:", newId);
        } else {
          console.error("❌ Failed to get resume ID from response:", response);
          toast.error("Resume created but ID not returned. Please refresh.");
        }
        toast.success("Resume created successfully");
      }
    } catch (error) {
      toast.error("Failed to save resume");
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save on step change
  const handleNextStep = async () => {
    if (currentStep < steps.length - 1) {
      await saveResume();
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateFormData = (path: string[], value: any) => {
    const newData = { ...formData };
    let obj: any = newData;
    for (let i = 0; i < path.length - 1; i++) {
      obj = obj[path[i]];
    }
    obj[path[path.length - 1]] = value;
    setFormData(newData);
  };

  const MONTH_MIN = "1980-01";
  const MONTH_MAX = "2040-12";
  const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
  const currentMonth = new Date().toISOString().slice(0, 7);

  const normalizeMonthValue = (value: string) => {
    if (!value || typeof value !== "string") return "";
    const trimmed = value.trim();
    return MONTH_PATTERN.test(trimmed) ? trimmed : "";
  };

  const monthIndex = (value: string) => {
    if (!MONTH_PATTERN.test(value)) return null;
    const [year, month] = value.split("-").map(Number);
    return (year * 12) + (month - 1);
  };

  const validateExperienceDates = (experience: ResumeData["experience"]) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < experience.length; i++) {
      const exp = experience[i];
      const label = `Experience ${i + 1}`;
      const start = normalizeMonthValue(exp.startDate);
      const end = normalizeMonthValue(exp.endDate);
      const isPresent = !!exp.isPresent;

      if (exp.startDate && !start) {
        errors.push(`${label}: Start date must be in YYYY-MM format.`);
        continue;
      }

      if (exp.endDate && !end) {
        errors.push(`${label}: End date must be in YYYY-MM format.`);
        continue;
      }

      if (start && !isPresent && start > currentMonth) {
        errors.push(`${label}: Start date cannot be in the future unless Present is checked.`);
        continue;
      }

      if (start && end && end < start) {
        errors.push(`${label}: End date cannot be before start date.`);
        continue;
      }

      if (start) {
        const startIdx = monthIndex(start);
        const endIdx = monthIndex(isPresent ? currentMonth : end);
        if (startIdx !== null && endIdx !== null) {
          const durationMonths = endIdx - startIdx;
          if (durationMonths < 1) {
            warnings.push(`${label}: Duration is less than 1 month.`);
          }
        }
      }
    }

    return { errors, warnings };
  };

  if (isLoading) {
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
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Create Resume</h1>
                <p className="text-sm text-gray-600">Step {currentStep + 1} of {steps.length}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <input 
                type="file" 
                accept="application/pdf" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="secondary"
                disabled={isUploading || isSaving}
                className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-none"
              >
                {isUploading ? (
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload PDF
              </Button>
              <Button 
                onClick={saveResume}
                variant="outline"
                disabled={isSaving || isUploading}
              >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardContent className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Parsed Resume Found</h2>
              <p className="text-sm text-gray-600 mb-4">
                We've extracted information from your PDF. Would you like to auto-fill the form? Existing data will be overwritten where applicable.
              </p>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-sm">
                <ul className="space-y-2 text-gray-700">
                  <li className="flex justify-between">
                    <span>👤 Name & Contact</span>
                    <span className="font-semibold">{previewData.personalInfo?.fullName ? 'Found' : 'Missing'}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>📄 Summary</span>
                    <span className="font-semibold">{previewData.summary ? 'Found' : 'Missing'}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>🛠 Skills</span>
                    <span className="font-semibold">{previewData.skills?.length || 0} extracted</span>
                  </li>
                  <li className="flex justify-between">
                    <span>💼 Experience</span>
                    <span className="font-semibold">{previewData.experience?.length || 0} extracted</span>
                  </li>
                  <li className="flex justify-between">
                    <span>🎓 Education</span>
                    <span className="font-semibold">{previewData.education?.length || 0} extracted</span>
                  </li>
                  <li className="flex justify-between">
                    <span>🏆 Achievements</span>
                    <span className="font-semibold">{previewData.achievements?.length || 0} extracted</span>
                  </li>
                  <li className="flex justify-between">
                    <span>📜 Certifications</span>
                    <span className="font-semibold">{previewData.certifications?.length || 0} extracted</span>
                  </li>
                  {previewData.languages?.length > 0 && (
                    <li className="flex justify-between">
                      <span>🌐 Languages</span>
                      <span className="font-semibold">{previewData.languages.length} detected</span>
                    </li>
                  )}
                </ul>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setPreviewData(null)}>
                  Cancel
                </Button>
                <Button onClick={applyParsedData} className="bg-indigo-600 hover:bg-indigo-700">
                  Apply Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Optimized Banner */}
        {searchParams.get("optimized") === "true" && searchParams.get("jdId") && (
          <div className="mb-4 flex items-center justify-between gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800">Your resume has been optimized for the job description</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Review and edit the content below, then check your ATS Score when ready.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/ats-score?id=${resumeId}&jdId=${searchParams.get("jdId")}&fresh=true`)}
              className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              View ATS Score →
            </button>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div key={index} className="flex-1">
                <div 
                  className={`h-2 rounded-full transition-all ${
                    index <= currentStep ? "bg-indigo-600" : "bg-gray-200"
                  }`}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-2 text-xs">
            {steps.map((step, index) => (
              <span 
                key={index}
                className={index <= currentStep ? "text-indigo-600 font-semibold" : "text-gray-500"}
              >
                {step}
              </span>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <Card className="border border-gray-200 mb-6">
          <CardContent className="p-8">
            {/* Step 0: Title and Personal Info */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Resume Title</h2>
                  <p className="text-gray-600">Give your resume a descriptive name</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resumeTitle">Resume Title *</Label>
                  <Input 
                    id="resumeTitle"
                    name="resumeTitle"
                    value={formData.resumeTitle}
                    onChange={(e) => updateFormData(["resumeTitle"], e.target.value)}
                    placeholder="e.g., Senior Software Engineer 2024"
                    required
                  />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Personal Information</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input 
                        id="fullName"
                        name="fullName"
                        value={formData.personalInfo.fullName}
                        onChange={(e) => updateFormData(["personalInfo", "fullName"], e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input 
                        id="email"
                        name="email"
                        type="email"
                        value={formData.personalInfo.email}
                        onChange={(e) => updateFormData(["personalInfo", "email"], e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input 
                        id="phone"
                        name="phone"
                        value={formData.personalInfo.phone}
                        onChange={(e) => updateFormData(["personalInfo", "phone"], e.target.value)}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input 
                        id="location"
                        name="location"
                        value={formData.personalInfo.location}
                        onChange={(e) => updateFormData(["personalInfo", "location"], e.target.value)}
                        placeholder="San Francisco, CA"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="linkedin">LinkedIn</Label>
                      <Input 
                        id="linkedin"
                        name="linkedin"
                        value={formData.personalInfo.linkedin}
                        onChange={(e) => updateFormData(["personalInfo", "linkedin"], e.target.value)}
                        placeholder="linkedin.com/in/johndoe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="github">GitHub</Label>
                      <Input 
                        id="github"
                        name="github"
                        value={formData.personalInfo.github}
                        onChange={(e) => updateFormData(["personalInfo", "github"], e.target.value)}
                        placeholder="github.com/johndoe"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="portfolio">Portfolio / Website</Label>
                      <Input 
                        id="portfolio"
                        name="portfolio"
                        value={formData.personalInfo.portfolio}
                        onChange={(e) => updateFormData(["personalInfo", "portfolio"], e.target.value)}
                        placeholder="johndoe.com"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Summary */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Professional Summary</h2>
                  <p className="text-gray-600">Write a brief overview of your experience and skills</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary">Summary *</Label>
                  <Textarea
                    id="summary"
                    rows={8}
                    value={formData.summary}
                    onChange={(e) => updateFormData(["summary"], e.target.value)}
                    placeholder="Experienced software engineer with 5+ years of expertise in full-stack development..."
                    className="resize-none"
                  />
                  <p className="text-sm text-gray-500">Recommended: 3-5 sentences (50-150 words)</p>
                </div>
              </div>
            )}

            {/* Step 2: Skills */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Skills</h2>
                  <p className="text-gray-600">Add your technical and soft skills</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skill">Add Skill</Label>
                  <div className="flex gap-2">
                    <Input
                      id="skill"
                      placeholder="e.g., React, Python, Project Management"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (skillInput.trim()) {
                            updateFormData(["skills"], [...formData.skills, skillInput.trim()]);
                            setSkillInput("");
                          }
                        }
                      }}
                    />
                    <Button 
                      onClick={() => {
                        if (skillInput.trim()) {
                          updateFormData(["skills"], [...formData.skills, skillInput.trim()]);
                          setSkillInput("");
                        }
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.skills.map((skill) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="px-3 py-2 text-sm bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                    >
                      {skill}
                      <button
                        onClick={() => updateFormData(["skills"], formData.skills.filter((s) => s !== skill))}
                        className="ml-2 hover:text-indigo-900"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>

                {formData.skills.length === 0 && (
                  <p className="text-sm text-gray-500">No skills added yet. Add at least 5-10 relevant skills.</p>
                )}
              </div>
            )}

            {/* Step 3: Experience */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Work Experience</h2>
                    <p className="text-gray-600">Add your professional experience</p>
                  </div>
                  <Button 
                    onClick={() => {
                      const newExp = {
                        id: Date.now().toString(),
                        jobTitle: "",
                        company: "",
                        startDate: "",
                        endDate: "",
                        isPresent: false,
                        description: "",
                      };
                      updateFormData(["experience"], [...formData.experience, newExp]);
                    }}
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Experience
                  </Button>
                </div>

                {formData.experience.map((exp, index) => (
                  <Card key={exp.id} className="border border-gray-200 bg-gray-50">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Experience {index + 1}</h3>
                        {formData.experience.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateFormData(["experience"], formData.experience.filter((e) => e.id !== exp.id))}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`exp-${exp.id}-jobTitle`}>Job Title *</Label>
                        <Input
                          id={`exp-${exp.id}-jobTitle`}
                          name={`exp-${exp.id}-jobTitle`}
                          autoComplete="organization-title"
                          value={exp.jobTitle}
                          onChange={(e) => {
                            const updated = formData.experience.map((x) => 
                              x.id === exp.id ? { ...x, jobTitle: e.target.value } : x
                            );
                            updateFormData(["experience"], updated);
                          }}
                          placeholder="Senior Software Engineer"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`exp-${exp.id}-company`}>Company *</Label>
                        <Input
                          id={`exp-${exp.id}-company`}
                          name={`exp-${exp.id}-company`}
                          autoComplete="organization"
                          value={exp.company}
                          onChange={(e) => {
                            const updated = formData.experience.map((x) => 
                              x.id === exp.id ? { ...x, company: e.target.value } : x
                            );
                            updateFormData(["experience"], updated);
                          }}
                          placeholder="Tech Corp"
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`exp-${exp.id}-startDate`}>Start Date *</Label>
                          <div className="flex gap-2">
                            <select
                              value={exp.startDate.split('-')[0] || ''}
                              onChange={(e) => {
                                const year = e.target.value;
                                const month = exp.startDate.split('-')[1] || '01';
                                const updated = formData.experience.map((x) => 
                                  x.id === exp.id ? { ...x, startDate: year ? `${year}-${month}` : '' } : x
                                );
                                updateFormData(["experience"], updated);
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="">Year</option>
                              {Array.from({ length: 70 }, (_, i) => 1970 + i).map(year => (
                                <option key={year} value={year}>{year}</option>
                              ))}
                            </select>
                            <select
                              value={exp.startDate.split('-')[1] || ''}
                              onChange={(e) => {
                                const year = exp.startDate.split('-')[0] || new Date().getFullYear();
                                const month = e.target.value;
                                const updated = formData.experience.map((x) => 
                                  x.id === exp.id ? { ...x, startDate: month ? `${year}-${month}` : '' } : x
                                );
                                updateFormData(["experience"], updated);
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="">Month</option>
                              {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(month => (
                                <option key={month} value={month}>
                                  {new Date(2000, parseInt(month) - 1).toLocaleString('default', { month: 'long' })}
                                </option>
                              ))}
                            </select>
                          </div>
                          <p className="text-xs text-gray-500">Format: Year then Month</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`exp-${exp.id}-endDate`}>End Date</Label>
                            <label className="flex items-center gap-2 text-xs text-gray-600">
                              <input
                                type="checkbox"
                                checked={!!exp.isPresent}
                                onChange={(e) => {
                                  const updated = formData.experience.map((x) =>
                                    x.id === exp.id
                                      ? { ...x, isPresent: e.target.checked, endDate: e.target.checked ? "" : x.endDate }
                                      : x
                                  );
                                  updateFormData(["experience"], updated);
                                }}
                              />
                              Present
                            </label>
                          </div>
                          {!exp.isPresent && (
                            <div className="flex gap-2">
                              <select
                                value={exp.endDate.split('-')[0] || ''}
                                onChange={(e) => {
                                  const year = e.target.value;
                                  const month = exp.endDate.split('-')[1] || '01';
                                  const updated = formData.experience.map((x) => 
                                    x.id === exp.id ? { ...x, endDate: year ? `${year}-${month}` : '' } : x
                                  );
                                  updateFormData(["experience"], updated);
                                }}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              >
                                <option value="">Year</option>
                                {Array.from({ length: 70 }, (_, i) => 1970 + i).map(year => (
                                  <option key={year} value={year}>{year}</option>
                                ))}
                              </select>
                              <select
                                value={exp.endDate.split('-')[1] || ''}
                                onChange={(e) => {
                                  const year = exp.endDate.split('-')[0] || new Date().getFullYear();
                                  const month = e.target.value;
                                  const updated = formData.experience.map((x) => 
                                    x.id === exp.id ? { ...x, endDate: month ? `${year}-${month}` : '', isPresent: false } : x
                                  );
                                  updateFormData(["experience"], updated);
                                }}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                              >
                                <option value="">Month</option>
                                {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(month => (
                                  <option key={month} value={month}>
                                    {new Date(2000, parseInt(month) - 1).toLocaleString('default', { month: 'long' })}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {exp.isPresent && (
                            <p className="text-sm text-gray-600">Currently working here</p>
                          )}
                          <p className="text-xs text-gray-500">Format: Year then Month</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`exp-${exp.id}-description`}>Description & Achievements</Label>
                        <Textarea
                          id={`exp-${exp.id}-description`}
                          name={`exp-${exp.id}-description`}
                          rows={4}
                          value={exp.description}
                          onChange={(e) => {
                            const updated = formData.experience.map((x) => 
                              x.id === exp.id ? { ...x, description: e.target.value } : x
                            );
                            updateFormData(["experience"], updated);
                          }}
                          placeholder="• Led development of customer portal using React and Node.js&#10;• Improved system performance by 40% through optimization&#10;• Mentored 3 junior developers"
                          className="resize-none"
                        />
                        <p className="text-sm text-gray-500">Use bullet points for better ATS compatibility</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Step 4: Projects (similar structure) */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Projects</h2>
                    <p className="text-gray-600">Showcase your notable projects</p>
                  </div>
                  <Button 
                    onClick={() => {
                      const newProj = {
                        id: Date.now().toString(),
                        name: "",
                        technologies: "",
                        description: "",
                        link: "",
                      };
                      updateFormData(["projects"], [...formData.projects, newProj]);
                    }}
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Project
                  </Button>
                </div>

                {formData.projects.map((proj, index) => (
                  <Card key={proj.id} className="border border-gray-200 bg-gray-50">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Project {index + 1}</h3>
                        {formData.projects.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateFormData(["projects"], formData.projects.filter((p) => p.id !== proj.id))}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`proj-${proj.id}-name`}>Project Name *</Label>
                        <Input
                          id={`proj-${proj.id}-name`}
                          name={`proj-${proj.id}-name`}
                          value={proj.name}
                          onChange={(e) => {
                            const updated = formData.projects.map((x) => 
                              x.id === proj.id ? { ...x, name: e.target.value } : x
                            );
                            updateFormData(["projects"], updated);
                          }}
                          placeholder="E-commerce Platform"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`proj-${proj.id}-technologies`}>Technologies Used</Label>
                        <Input
                          id={`proj-${proj.id}-technologies`}
                          name={`proj-${proj.id}-technologies`}
                          value={proj.technologies}
                          onChange={(e) => {
                            const updated = formData.projects.map((x) => 
                              x.id === proj.id ? { ...x, technologies: e.target.value } : x
                            );
                            updateFormData(["projects"], updated);
                          }}
                          placeholder="React, Node.js, MongoDB"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`proj-${proj.id}-description`}>Description & Impact</Label>
                        <Textarea
                          id={`proj-${proj.id}-description`}
                          name={`proj-${proj.id}-description`}
                          rows={4}
                          value={proj.description}
                          onChange={(e) => {
                            const updated = formData.projects.map((x) => 
                              x.id === proj.id ? { ...x, description: e.target.value } : x
                            );
                            updateFormData(["projects"], updated);
                          }}
                          placeholder="• Built a full-stack e-commerce platform&#10;• Integrated Stripe payment gateway&#10;• Achieved 10,000+ monthly active users"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`proj-${proj.id}-link`}>Project Link (Optional)</Label>
                        <Input
                          id={`proj-${proj.id}-link`}
                          name={`proj-${proj.id}-link`}
                          value={proj.link}
                          onChange={(e) => {
                            const updated = formData.projects.map((x) => 
                              x.id === proj.id ? { ...x, link: e.target.value } : x
                            );
                            updateFormData(["projects"], updated);
                          }}
                          placeholder="github.com/johndoe/ecommerce"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Step 5: Education */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Education</h2>
                    <p className="text-gray-600">Add your educational background</p>
                  </div>
                  <Button 
                    onClick={() => {
                      const newEdu = {
                        id: Date.now().toString(),
                        degree: "",
                        institution: "",
                        graduationYear: "",
                        gpa: "",
                      };
                      updateFormData(["education"], [...formData.education, newEdu]);
                    }}
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Education
                  </Button>
                </div>

                {formData.education.map((edu, index) => (
                  <Card key={edu.id} className="border border-gray-200 bg-gray-50">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Education {index + 1}</h3>
                        {formData.education.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateFormData(["education"], formData.education.filter((e) => e.id !== edu.id))}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`edu-${edu.id}-degree`}>Degree *</Label>
                        <Input
                          id={`edu-${edu.id}-degree`}
                          name={`edu-${edu.id}-degree`}
                          value={edu.degree}
                          onChange={(e) => {
                            const updated = formData.education.map((x) => 
                              x.id === edu.id ? { ...x, degree: e.target.value } : x
                            );
                            updateFormData(["education"], updated);
                          }}
                          placeholder="Bachelor of Science in Computer Science"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`edu-${edu.id}-institution`}>Institution *</Label>
                        <Input
                          id={`edu-${edu.id}-institution`}
                          name={`edu-${edu.id}-institution`}
                          value={edu.institution}
                          onChange={(e) => {
                            const updated = formData.education.map((x) => 
                              x.id === edu.id ? { ...x, institution: e.target.value } : x
                            );
                            updateFormData(["education"], updated);
                          }}
                          placeholder="Stanford University"
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`edu-${edu.id}-graduationYear`}>Graduation Year *</Label>
                          <Input
                            id={`edu-${edu.id}-graduationYear`}
                            name={`edu-${edu.id}-graduationYear`}
                            type="number"
                            value={edu.graduationYear}
                            onChange={(e) => {
                              const updated = formData.education.map((x) => 
                                x.id === edu.id ? { ...x, graduationYear: e.target.value } : x
                              );
                              updateFormData(["education"], updated);
                            }}
                            placeholder="2020"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`edu-${edu.id}-gpa`}>GPA (Optional)</Label>
                          <Input
                            id={`edu-${edu.id}-gpa`}
                            name={`edu-${edu.id}-gpa`}
                            value={edu.gpa}
                            onChange={(e) => {
                              const updated = formData.education.map((x) => 
                                x.id === edu.id ? { ...x, gpa: e.target.value } : x
                              );
                              updateFormData(["education"], updated);
                            }}
                            placeholder="3.8/4.0"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Step 6: Certifications */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Certifications</h2>
                    <p className="text-gray-600">Add your professional certifications</p>
                  </div>
                  <Button 
                    onClick={() => {
                      const newCert = {
                        id: Date.now().toString(),
                        name: "",
                        organization: "",
                        issueDate: "",
                        expiryDate: "",
                        credentialId: "",
                      };
                      updateFormData(["certifications"], [...formData.certifications, newCert]);
                    }}
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Certification
                  </Button>
                </div>

                {formData.certifications.map((cert, index) => (
                  <Card key={cert.id} className="border border-gray-200 bg-gray-50">
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Certification {index + 1}</h3>
                        {formData.certifications.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateFormData(["certifications"], formData.certifications.filter((c) => c.id !== cert.id))}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`cert-${cert.id}-name`}>Certification Name *</Label>
                        <Input
                          id={`cert-${cert.id}-name`}
                          name={`cert-${cert.id}-name`}
                          value={cert.name}
                          onChange={(e) => {
                            const updated = formData.certifications.map((x) => 
                              x.id === cert.id ? { ...x, name: e.target.value } : x
                            );
                            updateFormData(["certifications"], updated);
                          }}
                          placeholder="AWS Certified Solutions Architect"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`cert-${cert.id}-organization`}>Issuing Organization *</Label>
                        <Input
                          id={`cert-${cert.id}-organization`}
                          name={`cert-${cert.id}-organization`}
                          value={cert.organization}
                          onChange={(e) => {
                            const updated = formData.certifications.map((x) => 
                              x.id === cert.id ? { ...x, organization: e.target.value } : x
                            );
                            updateFormData(["certifications"], updated);
                          }}
                          placeholder="Amazon Web Services"
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`cert-${cert.id}-issueDate`}>Issue Date</Label>
                          <div className="flex gap-2">
                            <select
                              value={cert.issueDate.split('-')[0] || ''}
                              onChange={(e) => {
                                const year = e.target.value;
                                const month = cert.issueDate.split('-')[1] || '01';
                                const updated = formData.certifications.map((x) => 
                                  x.id === cert.id ? { ...x, issueDate: year ? `${year}-${month}` : '' } : x
                                );
                                updateFormData(["certifications"], updated);
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="">Year</option>
                              {Array.from({ length: 70 }, (_, i) => 1970 + i).map(year => (
                                <option key={year} value={year}>{year}</option>
                              ))}
                            </select>
                            <select
                              value={cert.issueDate.split('-')[1] || ''}
                              onChange={(e) => {
                                const year = cert.issueDate.split('-')[0] || new Date().getFullYear();
                                const month = e.target.value;
                                const updated = formData.certifications.map((x) => 
                                  x.id === cert.id ? { ...x, issueDate: month ? `${year}-${month}` : '' } : x
                                );
                                updateFormData(["certifications"], updated);
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="">Month</option>
                              {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(month => (
                                <option key={month} value={month}>
                                  {new Date(2000, parseInt(month) - 1).toLocaleString('default', { month: 'long' })}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`cert-${cert.id}-expiryDate`}>Expiry Date (Optional)</Label>
                          <div className="flex gap-2">
                            <select
                              value={cert.expiryDate.split('-')[0] || ''}
                              onChange={(e) => {
                                const year = e.target.value;
                                const month = cert.expiryDate.split('-')[1] || '01';
                                const updated = formData.certifications.map((x) => 
                                  x.id === cert.id ? { ...x, expiryDate: year ? `${year}-${month}` : '' } : x
                                );
                                updateFormData(["certifications"], updated);
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="">Year</option>
                              {Array.from({ length: 70 }, (_, i) => 1970 + i).map(year => (
                                <option key={year} value={year}>{year}</option>
                              ))}
                            </select>
                            <select
                              value={cert.expiryDate.split('-')[1] || ''}
                              onChange={(e) => {
                                const year = cert.expiryDate.split('-')[0] || new Date().getFullYear();
                                const month = e.target.value;
                                const updated = formData.certifications.map((x) => 
                                  x.id === cert.id ? { ...x, expiryDate: month ? `${year}-${month}` : '' } : x
                                );
                                updateFormData(["certifications"], updated);
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                              <option value="">Month</option>
                              {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(month => (
                                <option key={month} value={month}>
                                  {new Date(2000, parseInt(month) - 1).toLocaleString('default', { month: 'long' })}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`cert-${cert.id}-credentialId`}>Credential ID (Optional)</Label>
                        <Input
                          id={`cert-${cert.id}-credentialId`}
                          name={`cert-${cert.id}-credentialId`}
                          value={cert.credentialId}
                          onChange={(e) => {
                            const updated = formData.certifications.map((x) => 
                              x.id === cert.id ? { ...x, credentialId: e.target.value } : x
                            );
                            updateFormData(["certifications"], updated);
                          }}
                          placeholder="ABC123XYZ"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Step 7: Achievements (optional — single textarea) */}
            {currentStep === 7 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Achievements</h2>
                  <p className="text-gray-600">Awards, publications, or notable contributions — optional but impactful</p>
                </div>

                <Card className="border border-gray-200">
                  <CardContent className="p-6 space-y-3">
                    <Label htmlFor="achievementsText">Your Achievements</Label>
                    <Textarea
                      id="achievementsText"
                      name="achievementsText"
                      rows={8}
                      value={formData.achievementsText || ""}
                      onChange={(e) => updateFormData(["achievementsText"], e.target.value)}
                      placeholder={
                        "• Won Best Innovation Award at Google Hackathon 2023\n" +
                        "• Published research paper on ML optimization in IEEE journal\n" +
                        "• Open-source contributor — 500+ GitHub stars on XYZ project\n" +
                        "• National finalist, ACM ICPC 2022\n" +
                        "• Recipient of Merit Scholarship, XYZ University"
                      }
                      className="resize-none font-mono text-sm leading-relaxed"
                    />
                    <p className="text-xs text-gray-500">
                      One achievement per line. Start each line with • for best formatting in the PDF.
                    </p>
                  </CardContent>
                </Card>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-900 font-medium text-sm">💡 What makes a strong achievement?</p>
                  <ul className="mt-2 space-y-1 text-xs text-blue-700">
                    <li>• Hackathon wins, coding challenge rankings, open-source contributions</li>
                    <li>• Publications, patents, conference talks, speaking engagements</li>
                    <li>• Scholarships, academic honours, industry awards, fellowships</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 8: Review */}
            {currentStep === 8 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Review Your Resume</h2>
                  <p className="text-gray-600">Check all the details before proceeding</p>
                </div>

                {(() => {
                  // Single source of truth for all validation in this step
                  const hasTitle    = formData.resumeTitle.trim().length > 0;
                  const hasPersonal = formData.personalInfo.fullName.trim().length > 0 &&
                                      formData.personalInfo.email.trim().length > 0;
                  const hasSummary  = formData.summary.trim().length > 0;
                  const hasSkills   = formData.skills.length > 0;
                  const hasExp      = formData.experience.some(e => e.jobTitle.trim() && e.company.trim());
                  const hasProjects = formData.projects.some(p => p.name.trim() && p.description.trim());
                  const hasEdu      = formData.education.some(e => e.degree.trim() && e.institution.trim());
                  const hasCerts    = formData.certifications.some(c => c.name.trim() && c.organization.trim());
                  const hasAch      = (formData.achievementsText || '').trim().length > 0;

                  const isComplete  = hasTitle && hasPersonal && hasSummary && hasSkills && hasExp;

                  const missing = [
                    !hasTitle    && "Resume Title",
                    !hasPersonal && "Name + Email",
                    !hasSummary  && "Professional Summary",
                    !hasSkills   && "At least one Skill",
                    !hasExp      && "At least one Experience entry",
                  ].filter(Boolean) as string[];

                  const sections = [
                    { label: "Resume Title",                                                                                        done: hasTitle },
                    { label: "Personal Information",                                                                                done: hasPersonal },
                    { label: "Professional Summary",                                                                                done: hasSummary },
                    { label: `Skills (${formData.skills.length})`,                                                                  done: hasSkills },
                    { label: `Work Experience (${formData.experience.filter(e => e.jobTitle.trim()).length})`,                       done: hasExp },
                    { label: `Projects (${formData.projects.filter(p => p.name.trim()).length})`,                                   done: hasProjects },
                    { label: `Education (${formData.education.filter(e => e.degree.trim()).length})`,                               done: hasEdu },
                    { label: `Certifications (${formData.certifications.filter(c => c.name.trim()).length})`,                       done: hasCerts },
                    { label: `Achievements (${(formData.achievementsText || '').split('\n').filter(l => l.trim()).length} lines) — optional`, done: hasAch },
                  ];

                  return (
                    <>
                      <Card className={`border ${isComplete ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}`}>
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 shrink-0 ${isComplete ? "bg-green-600" : "bg-yellow-500"} rounded-full flex items-center justify-center`}>
                              <span className="text-2xl text-white font-bold">{isComplete ? "✓" : "!"}</span>
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900">
                                {isComplete ? "Resume Complete!" : "Resume Incomplete"}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {isComplete
                                  ? "All required sections have been filled"
                                  : `Still needed: ${missing.join(", ")}`}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="space-y-3">
                        {sections.map(({ label, done }) => (
                          <div key={label} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <span className="text-gray-700">{label}</span>
                            <span className={`font-semibold ${done ? "text-green-600" : "text-gray-400"}`}>
                              {done ? "✓" : "–"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}

                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <p className="text-indigo-900 font-medium">Next Steps:</p>
                  <ul className="mt-2 space-y-1 text-sm text-indigo-700">
                    <li>• Check your ATS score</li>
                    <li>• Choose a template</li>
                    <li>• Download your resume</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePrevStep}
            disabled={currentStep === 0}
          >
            Previous
          </Button>

          {currentStep === steps.length - 1 ? (
            <div className="flex gap-3">
              <Button 
                onClick={saveResume}
                className="bg-green-600 hover:bg-green-700"
                disabled={isSaving}
              >
                {isSaving ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {isSaving ? "Saving..." : "Save Resume"}
              </Button>
              <Link to={`/ats-score?id=${formData._id}`}>
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                  Check ATS Score
                </Button>
              </Link>
            </div>
          ) : (
            <Button
              onClick={handleNextStep}
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={isSaving}
            >
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
