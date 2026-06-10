/**
 * Data Transformer - Converts between frontend and backend data formats
 * 
 * Frontend and backend use different data structure. This utility
 * handles the conversion between them.
 */

// ================== TYPES ==================

// Frontend form data types
export interface FrontendPersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface FrontendExperience {
  id: string;
  jobTitle: string;
  company: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface FrontendProject {
  id: string;
  name: string;
  technologies: string;
  description: string;
  link: string;
}

export interface FrontendEducation {
  id: string;
  degree: string;
  institution: string;
  graduationYear: string;
  gpa: string;
}

export interface FrontendCertification {
  id: string;
  name: string;
  organization: string;
  issueDate: string;
  expiryDate: string;
  credentialId: string;
}

export interface FrontendResumeData {
  _id?: string;
  jdId?: string | null;
  resumeTitle: string;
  personalInfo: FrontendPersonalInfo;
  summary: string;
  skills: string[];
  experience: FrontendExperience[];
  projects: FrontendProject[];
  education: FrontendEducation[];
  certifications: FrontendCertification[];
  achievementsText?: string;
  achievements?: string[];
}

// Backend data types
export interface BackendPersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface BackendExperience {
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string[];
}

export interface BackendProject {
  title: string;
  techStack: string[];
  link: string;
  bullets: string[];
}

export interface BackendEducation {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  grade: string;
  location: string;
}

export interface BackendCertification {
  name: string;
  issuer: string;
  date: string;
  credentialId: string;
  url: string;
}

export interface BackendSkill {
  category: string;
  items: string[];
}

export interface BackendResumeData {
  _id?: string;
  jdId?: string | null;
  userId?: string;
  resumeTitle: string;
  personalInfo: BackendPersonalInfo;
  summary: string;
  skills: BackendSkill[];
  experience: BackendExperience[];
  projects: BackendProject[];
  education: BackendEducation[];
  certifications: BackendCertification[];
  achievements: string[];
  languages: Array<{ name: string; proficiency: string }>;
  templateId: string;
  isPublic: boolean;
  downloadCount: number;
  createdAt?: string;
  updatedAt?: string;
}

// ATS Score types
export interface BackendScoreBreakdown {
  keywordMatch?: number;
  formatting?: number;
  completeness?: number;
  actionVerbs?: number;
  readability?: number;
  keywordMatchScore?: {
    score: number;
    weight: number;
    details: {
      matchedKeywords: string[];
      totalJDKeywords: number;
      matchPercentage: number;
    };
  };
  sectionCompletenessScore?: {
    score: number;
    weight: number;
    details: {
      presentSections: string[];
      missingSections: string[];
    };
  };
  formattingScore?: {
    score: number;
    weight: number;
    details: any;
  };
  actionVerbScore?: {
    score: number;
    weight: number;
    details: {
      actionVerbsFound: string[];
      totalBullets: number;
      bulletsWithActionVerbs: number;
    };
  };
  readabilityScore?: {
    score: number;
    weight: number;
    details: any;
  };
}

export interface BackendMissingKeyword {
  keyword: string;
  category: string;
  importance: string;
}

export interface BackendSuggestion {
  id: string;
  type: string;
  severity: string;
  section: string;
  targetSection?: string;
  targetIndex?: any;
  currentText: string;
  suggestedText: string;
  reason: string;
  impact: number | string;
  applied: boolean;
  confidenceScore?: number;
}

export interface BackendATSReport {
  totalScore: number | null;
  breakdown: BackendScoreBreakdown;
  scoringMode?: 'general' | 'job-specific';
  message?: string;
  missingKeywords: Array<BackendMissingKeyword | string>;
  missingSections?: string[];
  suggestions: BackendSuggestion[];
  overallFeedback: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}

// Frontend ATS types
export interface FrontendScoreBreakdown {
  keyword_match?: number;
  formatting: number;
  completeness: number;
  action_verbs: number;
  readability: number;
}

export interface FrontendSuggestion {
  id: string;
  title: string;
  current: string;
  improved: string;
  impact: 'high' | 'medium' | 'low';
  section: string;
  // CRITICAL: targetIndex is required for experience/project bullet updates
  targetIndex?: {
    expIndex?: number;
    bulletIndex?: number;
    projIndex?: number;
  } | number;
}

// ================== TRANSFORMERS ==================

/**
 * Convert frontend resume data to backend format
 */
export const transformToBackend = (frontendData: FrontendResumeData): BackendResumeData => {
  const backendData: BackendResumeData = {
    _id: frontendData._id,
    resumeTitle: frontendData.resumeTitle || 'Untitled Resume',
    personalInfo: {
      fullName: frontendData.personalInfo?.fullName || '',
      email: frontendData.personalInfo?.email || '',
      phone: frontendData.personalInfo?.phone || '',
      location: frontendData.personalInfo?.location || '',
      linkedin: frontendData.personalInfo?.linkedin || '',
      github: frontendData.personalInfo?.github || '',
      portfolio: frontendData.personalInfo?.portfolio || '',
    },
    summary: frontendData.summary || '',
    
    // Transform skills: string[] -> { category: string, items: string[] }[]
    skills: transformSkillsToBackend(frontendData.skills),
    
    // Transform experience
    experience: transformExperienceToBackend(frontendData.experience),
    
    // Transform projects
    projects: transformProjectsToBackend(frontendData.projects),
    
    // Transform education
    education: transformEducationToBackend(frontendData.education),
    
    // Transform certifications
    certifications: transformCertificationsToBackend(frontendData.certifications),
    
    // Transform achievements: achievementsText string -> string[] array
    achievements: transformAchievementsToBackend(frontendData.achievementsText),
    languages: [],
    templateId: 'classic',
    isPublic: false,
    downloadCount: 0,
  };

  return backendData;
};

/**
 * Transform frontend skills to backend format
 */
const transformSkillsToBackend = (skills: string[]): BackendSkill[] => {
  if (!skills || skills.length === 0) {
    return [];
  }

  // Group skills by category or put all in "Technical Skills"
  return [{
    category: 'Technical Skills',
    items: skills.filter(s => s && s.trim()),
  }];
};

/**
 * Transform frontend experience to backend format
 */
const transformExperienceToBackend = (experience: FrontendExperience[]): BackendExperience[] => {
  if (!experience || experience.length === 0) {
    return [];
  }

  return experience
    .filter(exp => exp && (exp.jobTitle || exp.company))
    .map(exp => ({
      company: exp.company || '',
      role: exp.jobTitle || '',
      location: '',
      startDate: exp.startDate || '',
      endDate: exp.endDate || '',
      current: !exp.endDate,
      // Split description into bullets
      bullets: exp.description 
        ? exp.description.split('\n').filter(b => b.trim()).map(b => b.replace(/^[•\-\*]\s*/, ''))
        : [],
    }));
};

/**
 * Transform frontend projects to backend format
 */
const transformProjectsToBackend = (projects: FrontendProject[]): BackendProject[] => {
  if (!projects || projects.length === 0) {
    return [];
  }

  return projects
    .filter(proj => proj && (proj.name || proj.technologies))
    .map(proj => ({
      title: proj.name || '',
      techStack: proj.technologies 
        ? proj.technologies.split(',').map(t => t.trim()).filter(Boolean)
        : [],
      link: proj.link || '',
      bullets: proj.description
        ? proj.description.split('\n').filter(b => b.trim()).map(b => b.replace(/^[•\-\*]\s*/, ''))
        : [],
    }));
};

/**
 * Transform frontend education to backend format
 */
const transformEducationToBackend = (education: FrontendEducation[]): BackendEducation[] => {
  if (!education || education.length === 0) {
    return [];
  }

  return education
    .filter(edu => edu && (edu.degree || edu.institution))
    .map(edu => ({
      institution: edu.institution || '',
      degree: edu.degree || '',
      field: '',
      startDate: '',
      endDate: edu.graduationYear || '',
      grade: edu.gpa || '',
      location: '',
    }));
};

/**
 * Transform frontend certifications to backend format
 */
const transformCertificationsToBackend = (certifications: FrontendCertification[]): BackendCertification[] => {
  if (!certifications || certifications.length === 0) {
    return [];
  }

  return certifications
    .filter(cert => cert && cert.name)
    .map(cert => ({
      name: cert.name || '',
      issuer: cert.organization || '',
      date: cert.issueDate || '',
      credentialId: cert.credentialId || '',
      url: '',
    }));
};

/**
 * Transform frontend achievementsText to backend achievements array
 */
const transformAchievementsToBackend = (achievementsText?: string): string[] => {
  if (!achievementsText || typeof achievementsText !== 'string') {
    return [];
  }
  return achievementsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
};

/**
 * Transform backend resume data to frontend format
 */
export const transformFromBackend = (backendData: BackendResumeData): FrontendResumeData => {
  const frontendData: FrontendResumeData = {
    _id: backendData._id,
    jdId: backendData.jdId ?? null,
    resumeTitle: backendData.resumeTitle || '',
    personalInfo: {
      fullName: backendData.personalInfo?.fullName || '',
      email: backendData.personalInfo?.email || '',
      phone: backendData.personalInfo?.phone || '',
      location: backendData.personalInfo?.location || '',
      linkedin: backendData.personalInfo?.linkedin || '',
      github: backendData.personalInfo?.github || '',
      portfolio: backendData.personalInfo?.portfolio || '',
    },
    summary: backendData.summary || '',
    
    // Transform skills
    skills: transformSkillsFromBackend(backendData.skills),
    
    // Transform experience
    experience: transformExperienceFromBackend(backendData.experience),
    
    // Transform projects
    projects: transformProjectsFromBackend(backendData.projects),
    
    // Transform education
    education: transformEducationFromBackend(backendData.education),
    
    // Transform certifications
    certifications: transformCertificationsFromBackend(backendData.certifications),
    
    // Transform achievements: string[] -> achievementsText string
    achievementsText: backendData.achievements ? backendData.achievements.join('\n') : '',
    achievements: backendData.achievements || [],
  };

  return frontendData;
};

/**
 * Transform backend skills to frontend format
 */
const transformSkillsFromBackend = (skills: BackendSkill[]): string[] => {
  if (!skills || skills.length === 0) {
    return [];
  }

  const allSkills: string[] = [];
  skills.forEach(skill => {
    if (skill.items) {
      allSkills.push(...skill.items);
    }
  });
  return allSkills;
};

/**
 * Helper: Normalize date to YYYY-MM format
 * Handles various input formats: "2020-01", "2020-01-15", "January 2020", "01/2020", etc.
 */
const normalizeDateToYYYYMM = (dateStr: string): string => {
  if (!dateStr || typeof dateStr !== 'string') return '';

  const trimmed = dateStr.trim();
  
  // Already in YYYY-MM format
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) {
    return trimmed;
  }

  // YYYY-MM-DD format (take year-month)
  const dateMatch = trimmed.match(/^(\d{4})-(0[1-9]|1[0-2])-\d{1,2}$/);
  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2]}`;
  }

  // MM/YYYY or M/YYYY format
  const slashMatch = trimmed.match(/^(0?[1-9]|1[0-2])\/(\d{4})$/);
  if (slashMatch) {
    const month = String(parseInt(slashMatch[1])).padStart(2, '0');
    return `${slashMatch[2]}-${month}`;
  }

  // Month name and year (e.g., "January 2020", "Jan 2020")
  const monthNameMatch = trimmed.match(/^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{4})$/i);
  if (monthNameMatch) {
    const monthMap: { [key: string]: string } = {
      'january': '01', 'february': '02', 'march': '03', 'april': '04',
      'may': '05', 'june': '06', 'july': '07', 'august': '08',
      'september': '09', 'october': '10', 'november': '11', 'december': '12',
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
      'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'sept': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };
    const monthLower = monthNameMatch[1].toLowerCase();
    const month = monthMap[monthLower];
    if (month) {
      return `${monthNameMatch[2]}-${month}`;
    }
  }

  // Just year (YYYY) - default to January
  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }

  // Could not parse - return empty
  return '';
};

/**
 * Transform backend experience to frontend format
 */
const transformExperienceFromBackend = (experience: BackendExperience[]): FrontendExperience[] => {
  if (!experience || experience.length === 0) {
    return [{ id: '1', jobTitle: '', company: '', startDate: '', endDate: '', description: '' }];
  }

  return experience.map((exp, index) => ({
    id: String(index + 1),
    jobTitle: exp.role || '',
    company: exp.company || '',
    startDate: normalizeDateToYYYYMM(exp.startDate || ''),
    endDate: normalizeDateToYYYYMM(exp.endDate || ''),
    description: exp.bullets ? exp.bullets.join('\n') : '',
  }));
};

/**
 * Transform backend projects to frontend format
 */
const transformProjectsFromBackend = (projects: BackendProject[]): FrontendProject[] => {
  if (!projects || projects.length === 0) {
    return [{ id: '1', name: '', technologies: '', description: '', link: '' }];
  }

  return projects.map((proj, index) => ({
    id: String(index + 1),
    name: proj.title || '',
    technologies: proj.techStack ? proj.techStack.join(', ') : '',
    description: proj.bullets ? proj.bullets.join('\n') : '',
    link: proj.link || '',
  }));
};

/**
 * Transform backend education to frontend format
 */
const transformEducationFromBackend = (education: BackendEducation[]): FrontendEducation[] => {
  if (!education || education.length === 0) {
    return [{ id: '1', degree: '', institution: '', graduationYear: '', gpa: '' }];
  }

  return education.map((edu, index) => ({
    id: String(index + 1),
    degree: edu.degree || '',
    institution: edu.institution || '',
    graduationYear: edu.endDate || '',
    gpa: edu.grade || '',
  }));
};

/**
 * Transform backend certifications to frontend format
 */
const transformCertificationsFromBackend = (certifications: BackendCertification[]): FrontendCertification[] => {
  if (!certifications || certifications.length === 0) {
    return [{ id: '1', name: '', organization: '', issueDate: '', expiryDate: '', credentialId: '' }];
  }

  return certifications.map((cert, index) => ({
    id: String(index + 1),
    name: cert.name || '',
    organization: cert.issuer || '',
    issueDate: normalizeDateToYYYYMM(cert.date || ''),
    expiryDate: normalizeDateToYYYYMM(cert.expiryDate || ''),
    credentialId: cert.credentialId || '',
  }));
};

// ================== ATS TRANSFORMERS ==================

/**
 * Transform backend ATS response to frontend format
 */
export const transformATSResponse = (backendReport: BackendATSReport) => {
  const breakdown = backendReport.breakdown || {};
  const isGeneralMode = backendReport.scoringMode === 'general';
  return {
    totalScore: backendReport.totalScore,
    scoringMode: backendReport.scoringMode,
    message: backendReport.message,
    breakdown: {
      keyword_match: isGeneralMode ? undefined : (breakdown.keywordMatch ?? breakdown.keywordMatchScore?.score ?? 0),
      formatting: breakdown.formatting ?? breakdown.formattingScore?.score ?? 0,
      completeness: breakdown.completeness ?? breakdown.sectionCompletenessScore?.score ?? 0,
      action_verbs: breakdown.actionVerbs ?? breakdown.actionVerbScore?.score ?? 0,
      readability: breakdown.readability ?? breakdown.readabilityScore?.score ?? 0,
    } as FrontendScoreBreakdown,
    missingKeywords: (backendReport.missingKeywords || [])
      .map((kw) => (typeof kw === 'string' ? kw : kw?.keyword))
      .filter(Boolean),
    missingSections: backendReport.missingSections || [],
    suggestions: transformSuggestions(backendReport.suggestions || []),
    overallFeedback: backendReport.overallFeedback,
  };
};

/**
 * Transform backend suggestions to frontend format
 * CRITICAL: Preserve targetIndex for experience/project bullet updates
 */
const transformSuggestions = (suggestions: BackendSuggestion[]): FrontendSuggestion[] => {
  return suggestions.map(sugg => ({
    id: sugg.id,
    title: getSuggestionTitle(sugg),
    current: sugg.currentText || '',
    improved: sugg.suggestedText || '',
    impact: mapSeverityToImpact(sugg.severity),
    section: sugg.targetSection || sugg.section,
    targetIndex: (sugg as any).targetIndex ?? undefined,
  }));
};

/**
 * Get a human-readable title for a suggestion
 */
const getSuggestionTitle = (sugg: BackendSuggestion): string => {
  switch (sugg.type) {
    case 'keyword':
      return `Add "${sugg.suggestedText.replace(/^Add "/, '').replace(/".*$/, '')}" keyword`;
    case 'content':
      return `Improve ${sugg.section} section`;
    case 'structure':
      return `Add ${sugg.section} section`;
    default:
      return `Improve ${sugg.section}`;
  }
};

/**
 * Map severity to impact level
 */
const mapSeverityToImpact = (severity: string): 'high' | 'medium' | 'low' => {
  switch (severity) {
    case 'high':
    case 'critical':
      return 'high';
    case 'medium':
    case 'important':
      return 'medium';
    default:
      return 'low';
  }
};
