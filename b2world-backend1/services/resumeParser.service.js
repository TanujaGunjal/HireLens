const { PDFParse } = require('pdf-parse');
const aiService = require('./ai.service');

class ResumeParserService {
  /**
   * Main entry point to parse a PDF buffer into structured JSON data.
   */
  static async parsePDF(buffer) {
    let parser;
    try {
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = result.text;
      
      return await this.extractStructuredData(text);
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw new Error('Failed to parse PDF document');
    } finally {
      if (parser) {
        await parser.destroy();
      }
    }
  }

  /**
   * Applies heuristic regex rules and optionally AI to extract data blocks 
   * into a schema compatible with our Frontend.
   */
  static async extractStructuredData(rawText) {
    // 1. Pre-processing & Garbage Cleaning
    // Remove duplicate labels, and normalize spaces
    let preprocessedText = rawText
      .replace(/\\n/g, '\n') // Step 1: Normalize inline literal \n into real newlines
      .replace(/\b(technical skills:)\s*\1/i, '$1') // dedup labels
      .replace(/[ \t]{2,}/g, ' ') // normalize horizontal whitespace
      .replace(/\n+/g, '\n'); // normalize newlines

    let rawCleanLines = preprocessedText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => {
        if (!line) return false;
        // Filter garbage patterns: "page 1 of 2", "--", etc.
        const upper = line.toUpperCase();
        if (/PAGE\s*\d+\s*OF\s*\d+/i.test(line)) return false;
        if (/^\d+\s*\/\s*\d+$/.test(line)) return false;
        if (line === '--' || line === '---') return false;
        if (line.length < 2 && !['A', 'C', 'R'].includes(upper)) return false;
        return true;
      });

    // 2. Section Identification Map
    const sectionConfig = {
      SUMMARY: ['SUMMARY', 'PROFILE', 'OBJECTIVE', 'PROFESSIONAL SUMMARY', 'ABOUT ME'],
      SKILLS: ['SKILLS', 'TECHNICAL SKILLS', 'CORE COMPETENCIES', 'EXPERTISE', 'SKILLSET'],
      EXPERIENCE: ['EXPERIENCE', 'WORK EXPERIENCE', 'EMPLOYMENT HISTORY', 'WORK HISTORY', 'PROFESSIONAL EXPERIENCE'],
      EDUCATION: ['EDUCATION', 'ACADEMIC BACKGROUND', 'ACADEMIC HISTORY'],
      PROJECTS: ['PROJECTS', 'PERSONAL PROJECTS', 'ACADEMIC PROJECTS', 'SELECTED PROJECTS'],
      CERTIFICATIONS: ['CERTIFICATIONS', 'LICENSES', 'CERTIFICATES', 'COURSES'],
      ACHIEVEMENTS: ['ACHIEVEMENTS', 'AWARDS', 'HONORS', 'RECOGNITION'],
      LANGUAGES: ['LANGUAGES', 'KNOWN LANGUAGES']
    };

    // Step 2 & 3: Fix Broken Words & Preserve Real Bullets (CRITICAL)
    const headerPatternStr = Object.values(sectionConfig).flat().join('|');
    const headerPatternRegex = new RegExp(`^(${headerPatternStr})[:\\s]*$`, 'i');

    const cleanLines = [];
    for (let i = 0; i < rawCleanLines.length; i++) {
       let currentLine = rawCleanLines[i];
       while (
          i + 1 < rawCleanLines.length &&
          !/[.:;]$/.test(currentLine.trim()) &&
          !/^[A-Z]/.test(rawCleanLines[i + 1].trim()) &&
          /^[a-z0-9]/.test(rawCleanLines[i + 1].trim()) &&
          !headerPatternRegex.test(currentLine) &&
          !headerPatternRegex.test(rawCleanLines[i + 1])
       ) {
          currentLine += " " + rawCleanLines[i + 1].trim();
          i++; // Skip the merged line
       }
       cleanLines.push(currentLine);
    }

    const text = cleanLines.join('\n');
    let confidence = 100;



    const sections = {};
    let currentHeader = 'INITIAL';
    sections[currentHeader] = [];

    // Allow optional colons/spaces at the end of headers to ensure they are caught
    const headerPattern = Object.values(sectionConfig).flat().join('|');
    const headerRegex = new RegExp(`^(${headerPattern})[:\\s]*$`, 'i');

    for (const line of cleanLines) {
      if (headerRegex.test(line)) {
        // Find which normalized header this belongs to
        const found = Object.keys(sectionConfig).find(key => 
          sectionConfig[key].includes(line.toUpperCase())
        );
        if (found) {
          currentHeader = found;
          sections[currentHeader] = sections[currentHeader] || [];
          continue;
        }
      }
      sections[currentHeader].push(line);
    }

    const getSectionLines = (key) => sections[key] || [];

    // 3. Extract Core Info (Personal Info)
    const initialLines = getSectionLines('INITIAL');
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
    const phoneRegex = /(?:(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
    
    let email = '';
    let phone = '';
    let fullName = '';

    for (const line of initialLines) {
      if (!email) {
        const match = line.match(emailRegex);
        if (match) email = match[1];
      }
      if (!phone) {
        const match = line.match(phoneRegex);
        if (match) phone = match[0].trim();
      }
      if (!fullName && line.length > 3 && !line.includes('@') && !/\d/.test(line)) {
        fullName = line;
      }
    }
    if (!email) confidence -= 20;

    // 4. Transform Sections
    
    // Skills: Step 6 Skill Cleanup - Remove duplicates, normalize to lowercase, remove repeated labels
    const skillLines = getSectionLines('SKILLS');
    const rawSkills = skillLines
      .flatMap(line => line.split(/[,\n•|·*]+/))
      .map(s => s.trim().toLowerCase())
      // Remove trailing/leading labels like "technical skills:" inside the string
      .map(s => s.replace(/^(technical skills|skills|technologies):\s*/i, ''))
      .filter(s => s.length > 1 && !headerRegex.test(s));
      
    const skills = [...new Set(rawSkills)].slice(0, 30);
    
    const projectLines = getSectionLines('PROJECTS');
    let projects = [];
    let currentProject = null;

    // ── STEP 3: Project Parser & STEP 4: Prevent Merging ────────────────────
    
    // Helper to commit current project
    const commitProject = () => {
      if (currentProject && currentProject.title) {
        projects.push(currentProject);
      }
      currentProject = null;
    };

    // Helper to start new project
    const startProject = (title) => {
      commitProject();
      currentProject = {
        title: title.trim(),
        techStack: [],
        bullets: []
      };
    };

    let bufferLine = '';
    
    // First pass to split out inline "Tech Stack:", handle broken sentences, and filter noise
    let normalizedProjectLines = [];
    for (let line of projectLines) {
      if (!line || !line.trim()) continue;
      
      // Step 5: Filter Noise
      if (line.includes('(Relevant knowledge areas:')) continue;
      
      line = line.replace(/^[•\-\*·]\s*/, '').trim();
      
      // Prevent project merging (Step 4) - Split "Title Tech Stack: React..."
      const techStackMatch = line.match(/(.*?)((?:Tech Stack|Technologies)[:\s].*)/i);
      if (techStackMatch) {
         if (techStackMatch[1].trim()) normalizedProjectLines.push(techStackMatch[1].trim());
         normalizedProjectLines.push(techStackMatch[2].trim());
      } else {
         // Step 4: Bullet generation - split by sentence boundary if no markers exist, but preserve real sentences
         const sentences = line.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean);
         for (const sentence of sentences) {
             const sub = sentence.trim();
             if (sub) normalizedProjectLines.push(sub);
         }
      }
    }

    for (const line of normalizedProjectLines) {
      if (!line) continue;

      const isBullet = line.startsWith('• ');
      const cleanLine = line.replace(/^•\s*/, '');
      const isTechStack = /^(Tech Stack|Technologies)[:\s]/i.test(line);

      // Detect project start (Step 3)
      // Line is title case (starts capital, no punctuation at end, relatively short) OR line before tech stack
      // Avoid verbs to prevent picking up unmarked bullets!
      const isCapitalizedHeading = /^[A-Z][a-zA-Z0-9\s&/-]{2,60}$/.test(line) && 
                                   !isTechStack && !line.includes('?') &&
                                   !/^(Developed|Implemented|Built|Designed|Created|Led|Managed|Worked|Used|Integrated|Added|Reduced)\b/i.test(line);

      if (!currentProject && !isTechStack) {
         startProject(line);
      } else if (isTechStack) {
         if (!currentProject) startProject('Project'); // Fallback
         currentProject.techStack.push(line.replace(/^(Tech Stack|Technologies)[:\s]+/i, ''));
      } else if (isCapitalizedHeading && currentProject && currentProject.bullets.length > 0) {
         startProject(line);
      } else if (isCapitalizedHeading && currentProject && line.includes(' - ')) {
         startProject(line);
      } else {
         if (!currentProject) startProject('Project');
         // Everything else gets treated as a bullet (Step 3: ALL remaining lines -> bullets)
         if (!currentProject.title || currentProject.title === 'Project') {
             currentProject.title = line;
         } else {
             currentProject.bullets.push(line);
         }
      }
    }
    commitProject();

    // ── STEP 5: Clean Project Output ─────────────────────────────────────────
    projects = projects.filter(p => p.title && (p.bullets.length >= 1 || p.techStack.length >= 1));

    // Fallback: If parsing failed completely, create at least 1 valid project
    if (projects.length === 0 && normalizedProjectLines.length > 0) {
       projects.push({
          title: "Extracted Project",
          techStack: [],
          bullets: normalizedProjectLines.map(l => l.replace(/^•\s*/, ''))
       });
    }

    // ── HYBRID PARSER LOGIC FOR PROJECTS ─────────────────────────────────────
    const ruleProjects = projects;
    let finalProjects = ruleProjects;
    let aiProjects = [];

    const rawProjectText = projectLines.join('\n');
    
    if (rawProjectText.trim()) {
      try {
        const parsed = await aiService.parseProjects(rawProjectText);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          // Validation Step 6: Ensure each project has title and at least 1 bullet/description
          const isValid = parsed.every(p => p.title && (p.description || (p.bullets && p.bullets.length > 0)));
          if (isValid) {
            aiProjects = parsed;
            // Merge Layer Step 5: Prefer AI to enhance missing fields/restructure
            finalProjects = aiProjects;
          }
        }
      } catch (err) {
        console.error("AI Semantic Parser failed for projects, falling back to rule-based:", err);
      }
    }

    // Map properties to expected output structure for the backend ecosystem
    // The existing system maps `name` instead of `title` for projects, so we conform.
    finalProjects = finalProjects.map((p, idx) => ({
      id: `p-${Date.now()}-${idx}`,
      name: p.title || p.name || 'Project',
      technologies: Array.isArray(p.techStack) ? p.techStack.join(', ') : (p.techStack || p.technologies || ''),
      description: p.description || ((p.bullets && p.bullets.length) ? p.bullets.join('\\n') : ''),
      link: p.link || ''
    }));

    // Step 9: DEBUG LOGS (IMPORTANT)
    console.log("RAW TEXT (Snippet):", rawText.substring(0, 150).replace(/\n/g, ' '));
    console.log("RULE PROJECTS:", JSON.stringify(ruleProjects, null, 2));
    console.log("AI PROJECTS:", JSON.stringify(aiProjects, null, 2));
    console.log("FINAL PROJECTS:", JSON.stringify(finalProjects, null, 2));
    // ──────────────────────────────────────────────────────────────────────────

    // Experience: Simple Map
    const expLines = getSectionLines('EXPERIENCE');
    const experience = expLines.length > 0 ? [{
      id: `e-${Date.now()}`,
      jobTitle: 'Extracted Experience',
      company: 'Please verify details',
      startDate: '',
      endDate: '',
      isPresent: false,
      description: expLines.join('\n')
    }] : [];

    // Simple Item Lists for new sections
    const mapToList = (lines) => lines
      .filter(l => l.length > 3)
      .map((l, i) => ({ id: `i-${Date.now()}-${i}`, title: l.replace(/^[•\-\*·]\s*/, '').trim() }));

    const achievements = mapToList(getSectionLines('ACHIEVEMENTS'));
    const certifications = mapToList(getSectionLines('CERTIFICATIONS'));
    const languages = getSectionLines('LANGUAGES')
      .filter(l => l.length > 2)
      .map((l, i) => ({ id: `l-${Date.now()}-${i}`, name: l.replace(/^[•\-\*·]\s*/, '').trim() }));

    const parsedData = {
      confidence: Math.max(0, confidence),
      parsedResume: {
        personalInfo: {
          fullName,
          email,
          phone,
          location: '',
          linkedin: '',
          github: '',
          portfolio: ''
        },
        summary: getSectionLines('SUMMARY').join(' '),
        skills,
        experience,
        education: getSectionLines('EDUCATION').length > 0 ? [{
          id: `edu-${Date.now()}`,
          degree: 'Extracted Education',
          institution: getSectionLines('EDUCATION')[0] || 'Please see full text',
          graduationYear: '',
          gpa: ''
        }] : [],
        projects: finalProjects,
        achievements,
        certifications,
        languages
      }
    };

    // ── STEP 7: VALIDATION LAYER ─────────────────────────────────────────────
    if (parsedData.parsedResume.projects.length === 0) {
      console.warn("Validation Warning: No projects extracted. Applying safer fallback.");
      const flatText = rawText.substring(0, 1000).replace(/\n/g, ' ');
      parsedData.parsedResume.projects = [{
        id: `p-${Date.now()}-fb`,
        name: "Extracted Project",
        technologies: "",
        description: flatText,
        link: ""
      }];
    }

    if (parsedData.parsedResume.skills.length === 0) {
      console.warn("Validation Warning: No skills extracted. Applying safer fallback.");
      parsedData.parsedResume.skills = ["Not Found"];
    }
    // ─────────────────────────────────────────────────────────────────────────

    return parsedData;
  }
}

module.exports = ResumeParserService;
