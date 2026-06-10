/**
 * ResumeGenerator - Generates resume content from Job Description
 * Uses JD keywords and structure to create ATS-optimized content
 */

const ACTION_VERBS = [
  'developed', 'implemented', 'designed', 'built', 'created', 'established',
  'improved', 'optimized', 'enhanced', 'streamlined', 'automated', 'led',
  'managed', 'coordinated', 'collaborated', 'delivered', 'achieved', 'increased',
  'reduced', 'analyzed', 'researched', 'maintained', 'deployed', 'integrated'
];

const IMPACT_PHRASES = [
  'resulting in {metric}% improvement',
  'leading to {metric}% increase in efficiency',
  'reducing processing time by {metric}%',
  'improving performance by {metric}%',
  'achieving {metric}% faster delivery',
  'increasing user satisfaction by {metric}%'
];

class ResumeGenerator {
  
  /**
   * Generate complete resume from JD
   */
  generateFromJD(jdData, userProfile = {}) {
    const role = jdData.roleDetected || 'Software Engineer';
    const skills = jdData.extractedKeywords || [];
    const responsibilities = jdData.responsibilities || [];

    return {
      resumeTitle: `${role} - ATS Optimized`,
      personalInfo: {
        fullName: userProfile.name || 'Your Name',
        email: userProfile.email || 'your.email@example.com',
        phone: userProfile.phone || '',
        location: userProfile.location || '',
        linkedin: userProfile.linkedin || '',
        github: userProfile.github || ''
      },
      summary: this.generateSummary(role, skills, jdData.experienceLevel),
      skills: this.generateSkills(skills),
      experience: this.generateExperience(role, skills, responsibilities),
      projects: this.generateProjects(role, skills),
      education: userProfile.education || this.generateDefaultEducation(),
      certifications: [],
      achievements: [],
      languages: [{ name: 'English', proficiency: 'Professional' }],
      templateId: 'classic'
    };
  }

  /**
   * Optimize existing resume with JD
   */
  optimizeWithJD(existingResume, jdData) {
    const optimized = { ...existingResume };
    const jdKeywords = jdData.extractedKeywords || [];
    
    // Optimize summary
    if (optimized.summary) {
      optimized.summary = this.enhanceSummary(
        optimized.summary, 
        jdData.roleDetected,
        jdKeywords
      );
    }

    // Optimize skills
    optimized.skills = this.enhanceSkills(optimized.skills, jdKeywords);

    // Optimize experience bullets
    if (optimized.experience) {
      optimized.experience = optimized.experience.map(exp => ({
        ...exp,
        bullets: exp.bullets.map(bullet => this.enhanceBullet(bullet, jdKeywords))
      }));
    }

    // Optimize projects
    if (optimized.projects) {
      optimized.projects = optimized.projects.map(proj => ({
        ...proj,
        bullets: proj.bullets.map(bullet => this.enhanceBullet(bullet, jdKeywords))
      }));
    }

    return optimized;
  }

  /**
   * Generate professional summary with JD context
   */
  generateSummary(role, skills, experienceLevel = 'Mid') {
    // SANITIZE ROLE: ensure it's a short clean title, not a raw JD sentence
    const VALID_ROLES = [
      'Full Stack Developer', 'Frontend Developer', 'Backend Developer',
      'Java Developer', 'Python Developer', 'DevOps Engineer', 'Data Scientist',
      'Data Analyst', 'Mobile Developer', 'Software Engineer', 'HR', 'Sales'
    ];
    
    // If role is not in valid list OR is too long OR contains suspicious text, use default
    const cleanRole = (role && role.length <= 40 && VALID_ROLES.includes(role))
      ? role
      : 'Software Engineer';
    
    const JUNK_WORDS = new Set([
      'admin', 'part', 'jd', 'if', 'logic', 'section', 'clean', 'modify',
      'summary', 'fix', 'builder', 'strictly', 'required', 'missing',
      'user', 'users', 'name', 'description', 'engine', 'match',
      'action', 'verbs', 'text', 'check', 'system', 'download',
      'score', 'api', 'ats', 'resume', 'pdf', 'keywords', 'existing'
    ]);
    
    const topSkills = skills
      .filter(s => {
        const kw = typeof s === 'string' ? s : s.keyword;
        return kw && kw.length >= 3 && !JUNK_WORDS.has(kw.toLowerCase());
      })
      .slice(0, 8)
      .map(s => typeof s === 'string' ? s : s.keyword);

    const experienceYears = {
      'Entry': '1-2 years', 'Mid': '3-5 years', 'Senior': '5-8 years',
      'Lead': '8-12 years', 'Executive': '12+ years', 'Unknown': '3+ years'
    };

    const years = experienceYears[experienceLevel] || '3+ years';
    const coreSkills = topSkills.slice(0, 4).join(', ');
    const additionalSkills = topSkills.slice(4, 8).join(', ');

    let summary = `Results-driven ${cleanRole} with ${years} of experience`;
    
    if (coreSkills) {
      summary += ` specializing in ${coreSkills}.`;
    } else {
      summary += ` building scalable web applications.`;
    }

    if (additionalSkills) {
      summary += ` Proficient in ${additionalSkills}, with a proven track record of delivering scalable solutions.`;
    } else {
      summary += ` Proven track record of delivering high-quality, scalable solutions.`;
    }

    const roleSpecificEndings = {
      'Full Stack Developer': ' Strong expertise in both frontend and backend technologies, with experience building end-to-end web applications.',
      'Frontend Developer': ' Passionate about creating intuitive, responsive user interfaces with exceptional attention to detail.',
      'Backend Developer': ' Focused on building robust, high-performance server-side applications and APIs.',
      'DevOps Engineer': ' Experienced in automating infrastructure, implementing CI/CD pipelines, and ensuring system reliability.',
      'Data Scientist': ' Skilled at extracting insights from complex datasets and building predictive models.',
      'Mobile Developer': ' Expert in developing cross-platform mobile applications with native performance.',
      'Software Engineer': ' Committed to writing clean, maintainable code and following best engineering practices.'
    };

    summary += roleSpecificEndings[cleanRole] || ' Strong problem-solving abilities and commitment to continuous learning and innovation.';

    return summary;
  }

  /**
   * Enhance existing summary with JD keywords
   */
  enhanceSummary(existingSummary, role, jdKeywords) {
    const keywordsList = jdKeywords.slice(0, 5).map(k => 
      typeof k === 'string' ? k : k.keyword
    );

    // Check if keywords are already present
    const missingKeywords = keywordsList.filter(kw => 
      !existingSummary.toLowerCase().includes(kw.toLowerCase())
    );

    if (missingKeywords.length === 0) {
      return existingSummary;
    }

    // Add missing keywords naturally
    const enhanced = existingSummary.trim();
    const addition = ` Proficient in ${missingKeywords.slice(0, 3).join(', ')}.`;
    
    return enhanced + addition;
  }

  /**
   * Generate skills section
   */
  generateSkills(jdSkills) {
    // FILTER: remove junk words that aren't real skills before categorizing
    const JUNK_WORDS = new Set([
      'admin', 'part', 'jd', 'if', 'logic', 'section', 'clean', 'modify',
      'summary', 'fix', 'builder', 'strictly', 'required', 'missing',
      'user', 'users', 'name', 'description', 'engine', 'match',
      'action', 'verbs', 'text', 'check', 'system', 'download',
      'score', 'ats', 'resume', 'pdf', 'keywords', 'existing',
      'formatting', 'completeness', 'readability', 'keywordmatch',
      'location', 'role', 'bullets', 'improved', 'templates'
    ]);

    const MIN_SKILL_LENGTH = 2;
    
    const filteredSkills = jdSkills.filter(skill => {
      const name = (typeof skill === 'string' ? skill : skill?.keyword || '').toLowerCase().trim();
      return (
        name.length >= MIN_SKILL_LENGTH &&
        !JUNK_WORDS.has(name) &&
        !/^\d+$/.test(name)  // No pure numbers
      );
    });

    const skillCategories = this.categorizeSkills(filteredSkills);
    
    const skills = [];

    if (skillCategories.programming.length > 0) {
      skills.push({
        category: 'Programming Languages',
        items: skillCategories.programming
      });
    }

    if (skillCategories.frameworks.length > 0) {
      skills.push({
        category: 'Frameworks & Libraries',
        items: skillCategories.frameworks
      });
    }

    if (skillCategories.tools.length > 0) {
      skills.push({
        category: 'Tools & Technologies',
        items: skillCategories.tools
      });
    }

    if (skillCategories.databases.length > 0) {
      skills.push({
        category: 'Databases',
        items: skillCategories.databases
      });
    }

    if (skillCategories.other.length > 0) {
      skills.push({
        category: 'Other Skills',
        items: skillCategories.other
      });
    }

    return skills;
  }

  /**
   * Categorize skills
   */
  categorizeSkills(skills) {
    const categories = {
      programming: [],
      frameworks: [],
      tools: [],
      databases: [],
      other: []
    };

    const programmingLangs = ['javascript', 'python', 'java', 'c++', 'c#', 'typescript', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin'];
    const frameworks = ['react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring', 'laravel', 'rails', '.net'];
    const databases = ['mongodb', 'postgresql', 'mysql', 'redis', 'cassandra', 'dynamodb', 'sql', 'nosql'];
    const tools = ['git', 'docker', 'kubernetes', 'jenkins', 'aws', 'azure', 'gcp', 'terraform', 'ansible'];

    skills.forEach(skill => {
      const skillName = typeof skill === 'string' ? skill : skill.keyword;
      const lower = skillName.toLowerCase();

      if (programmingLangs.some(pl => lower.includes(pl))) {
        categories.programming.push(skillName);
      } else if (frameworks.some(fw => lower.includes(fw))) {
        categories.frameworks.push(skillName);
      } else if (databases.some(db => lower.includes(db))) {
        categories.databases.push(skillName);
      } else if (tools.some(t => lower.includes(t))) {
        categories.tools.push(skillName);
      } else {
        categories.other.push(skillName);
      }
    });

    return categories;
  }

  /**
   * Enhance existing skills with JD keywords
   */
  enhanceSkills(existingSkills, jdKeywords) {
    if (!existingSkills || existingSkills.length === 0) {
      return this.generateSkills(jdKeywords);
    }

    const enhanced = [...existingSkills];
    const existingSkillText = JSON.stringify(existingSkills).toLowerCase();

    // Find missing keywords
    const missingSkills = jdKeywords
      .filter(k => {
        const keyword = typeof k === 'string' ? k : k.keyword;
        return !existingSkillText.includes(keyword.toLowerCase());
      })
      .slice(0, 10);

    if (missingSkills.length > 0) {
      // Add to appropriate categories or create new
      const newCategories = this.categorizeSkills(missingSkills);
      
      Object.entries(newCategories).forEach(([catName, items]) => {
        if (items.length > 0) {
          const categoryMap = {
            programming: 'Programming Languages',
            frameworks: 'Frameworks & Libraries',
            tools: 'Tools & Technologies',
            databases: 'Databases',
            other: 'Other Skills'
          };

          const categoryName = categoryMap[catName];
          const existingCategory = enhanced.find(c => c.category === categoryName);

          if (existingCategory) {
            existingCategory.items = [...new Set([...existingCategory.items, ...items])];
          } else {
            enhanced.push({
              category: categoryName,
              items
            });
          }
        }
      });
    }

    return enhanced;
  }

  /**
   * Generate experience section
   */
  generateExperience(role, skills, responsibilities) {
    const JUNK_WORDS = new Set([
      'admin', 'part', 'jd', 'if', 'logic', 'section', 'clean', 'summary',
      'fix', 'builder', 'strictly', 'required', 'missing', 'user', 'users',
      'name', 'description', 'engine', 'match', 'action', 'text', 'check',
      'system', 'download', 'score', 'ats', 'resume', 'pdf', 'keywords',
      'existing', 'formatting', 'templates', 'location', 'role', 'bullets'
    ]);

    const topSkills = skills
      .map(s => typeof s === 'string' ? s : s.keyword)
      .filter(s => s && s.length >= 2 && !JUNK_WORDS.has(s.toLowerCase()))
      .slice(0, 10);

    // Use generic company names (user will fill in real details)
    const COMPANY_NAMES = [
      '[Your Current Company]',
      '[Your Previous Company]'
    ];

    const experience = [];

    for (let i = 0; i < 2; i++) {
      const bullets = this.generateExperienceBullets(role, topSkills, responsibilities, 4);
      experience.push({
        company: COMPANY_NAMES[i],
        role: role,
        location: '[City, State]',
        startDate: i === 0 ? 'Jan 2023' : 'Jan 2021',
        endDate: i === 0 ? 'Present' : 'Dec 2022',
        current: i === 0,
        bullets: bullets.filter(b => b && b.length > 10)
      });
    }

    return experience;
  }

  /**
   * Generate experience bullets with better intelligence
   */
  generateExperienceBullets(role, skills, responsibilities, count = 4) {
    const bullets = [];

    // Use actual JD responsibilities if available
    if (responsibilities && responsibilities.length > 0) {
      // Convert responsibilities to achievement-oriented bullets
      for (const resp of responsibilities.slice(0, Math.min(3, count))) {
        const bullet = this.convertResponsibilityToBullet(resp, skills);
        if (bullet) bullets.push(bullet);  // ← Only add non-null results
      }
    }

    // Fill remaining with skill-based templates using ONLY clean skills
    const cleanSkills = skills.filter(s => s && s.length >= 3);
    const remainingCount = count - bullets.length;
    
    const GOOD_TEMPLATES = [
      (skill, metric) => `Developed scalable ${skill} solutions, improving system performance by ${metric}%`,
      (skill, metric) => `Implemented ${skill} architecture that reduced deployment time by ${metric}%`,
      (skill, metric) => `Optimized ${skill} pipelines, achieving ${metric}% reduction in processing latency`,
      (skill, metric) => `Architected ${skill}-based microservices, increasing system reliability by ${metric}%`,
      (skill, metric) => `Built RESTful APIs using ${skill}, serving 10K+ requests per minute`,
      (skill, metric) => `Delivered ${skill} features end-to-end, reducing bug count by ${metric}%`,
    ];

    for (let i = 0; i < remainingCount && i < cleanSkills.length; i++) {
      const skill = cleanSkills[i];
      const metric = 20 + Math.floor(Math.random() * 40);
      const template = GOOD_TEMPLATES[i % GOOD_TEMPLATES.length];
      bullets.push(template(skill, metric));
    }

    // Add one soft skill / collaboration bullet
    const softBullets = [
      'Mentored junior developers and conducted code reviews to maintain code quality standards',
      'Collaborated with product managers and designers to define technical requirements',
      'Led agile sprint planning and retrospectives with cross-functional teams of 5-8 members',
    ];
    if (bullets.length < count) {
      bullets.push(softBullets[Math.floor(Math.random() * softBullets.length)]);
    }

    return bullets.filter(Boolean).slice(0, count);
  }

  /**
   * Convert JD responsibility to achievement bullet
   */
  convertResponsibilityToBullet(responsibility, skills) {
    if (!responsibility || typeof responsibility !== 'string') return null;

    // CRITICAL: Skip lines that are JD meta-text (not actual responsibilities)
    const SKIP_PATTERNS = [
      /^(you are|we are|we offer|about us|our team|this role|join us|the company)/i,
      /^(i have|i am|the candidate|applicant)/i,
      /^\s*(note|disclaimer|equal opportunity)/i,
      /^(responsibilities:|requirements:|qualifications:|about the role)/i,
    ];

    if (SKIP_PATTERNS.some(p => p.test(responsibility.trim()))) {
      return null;  // Signal caller to skip this one
    }

    const verb = ACTION_VERBS[Math.floor(Math.random() * ACTION_VERBS.length)];
    const relevantSkill = skills[Math.floor(Math.random() * Math.min(3, skills.length))];
    const metric = 20 + Math.floor(Math.random() * 40);

    // Clean the responsibility text
    let cleaned = responsibility
      .replace(/^[-•*]\s*/, '')
      .replace(/^(you will|you'll|responsible for|develop|design|implement|maintain|create|build)\s+/i, '')
      .trim();

    // Only keep if resulting text is meaningful (not too short, not raw JD instruction)
    if (cleaned.length < 10) return null;

    // Capitalize first letter
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

    // Add action verb prefix if needed
    if (!/^(developed|implemented|designed|built|created|led|managed|deployed|optimized)/i.test(cleaned)) {
      cleaned = `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
    }

    // Add impact metric if the sentence is not too long
    if (cleaned.length < 100 && !cleaned.includes('%')) {
      cleaned += `, resulting in ${metric}% improvement in delivery time`;
    }

    return cleaned;
  }

  /**
   * Enhance bullet point
   */
  enhanceBullet(bullet, jdKeywords) {
    const lowerBullet = bullet.toLowerCase();
    
    // Check if it already starts with action verb
    const hasActionVerb = ACTION_VERBS.some(verb => lowerBullet.startsWith(verb));
    
    if (!hasActionVerb) {
      // Add action verb
      const verb = ACTION_VERBS[Math.floor(Math.random() * 8)];
      bullet = verb.charAt(0).toUpperCase() + verb.slice(1) + ' ' + bullet.toLowerCase();
    }

    // Check if it has quantifiable metrics
    const hasMetric = /\d+%|\d+x|\d+ users|\d+ hours|reduced|increased|improved/.test(lowerBullet);
    
    if (!hasMetric && bullet.length < 100) {
      // Add impact metric
      const metric = 15 + Math.floor(Math.random() * 35); // 15-50%
      bullet += `, improving efficiency by ${metric}%`;
    }

    // Naturally incorporate missing keywords
    const bulletLower = bullet.toLowerCase();
    const missingKeyword = jdKeywords.find(k => {
      const keyword = typeof k === 'string' ? k : k.keyword;
      return keyword && !bulletLower.includes(keyword.toLowerCase());
    });

    if (missingKeyword && bullet.length < 120) {
      const keyword = typeof missingKeyword === 'string' ? missingKeyword : missingKeyword.keyword;
      bullet += ` using ${keyword}`;
    }

    return bullet;
  }

  /**
   * Generate projects section
   */
  generateProjects(role, skills) {
    const JUNK_WORDS = new Set([
      'admin', 'part', 'jd', 'if', 'logic', 'section', 'clean', 'summary',
      'fix', 'builder', 'strictly', 'required', 'missing', 'user', 'users',
      'name', 'description', 'engine', 'match', 'action', 'text', 'check',
      'system', 'download', 'score', 'ats', 'resume', 'pdf', 'keywords',
      'existing', 'formatting', 'templates'
    ]);

    const topSkills = skills
      .map(s => typeof s === 'string' ? s : s.keyword)
      .filter(s => s && s.length >= 2 && !JUNK_WORDS.has(s.toLowerCase()))
      .slice(0, 9);

    // Role-based default project names
    const ROLE_PROJECT_NAMES = {
      'Full Stack Developer': ['Full Stack Web Application', 'RESTful API Platform'],
      'Frontend Developer': ['React Dashboard Application', 'UI Component Library'],
      'Backend Developer': ['Microservices Backend API', 'Database Optimization Tool'],
      'Java Developer': ['Spring Boot REST API', 'Java Microservices Platform'],
      'Python Developer': ['Python Data Pipeline', 'Flask REST API Service'],
      'DevOps Engineer': ['CI/CD Pipeline Automation', 'Infrastructure as Code Setup'],
      'Data Scientist': ['ML Model Pipeline', 'Data Analysis Dashboard'],
      'Software Engineer': ['Web Application Platform', 'API Integration Service'],
    };

    const projectNames = ROLE_PROJECT_NAMES[role] || ['Web Application Project', 'Backend API Project'];
    const projects = [];

    for (let i = 0; i < 2; i++) {
      const projectSkills = topSkills.slice(i * 3, (i + 1) * 3);
      
      projects.push({
        title: projectNames[i] || `[Project ${i + 1}]`,
        techStack: projectSkills.length > 0 ? projectSkills : ['[Add Tech Stack]'],
        link: '',
        bullets: this.generateProjectBullets(projectSkills, 3)
      });
    }

    return projects;
  }

  /**
   * Generate project bullets
   */
  generateProjectBullets(techStack, count = 3) {
    const JUNK_WORDS = new Set([
      'admin', 'part', 'jd', 'if', 'logic', 'section', 'clean', 'summary',
      'fix', 'strictly', 'missing', 'match', 'action', 'text', 'check'
    ]);
    
    // Only use clean skills for project bullets
    const cleanStack = (techStack || []).filter(s => 
      s && s.length >= 2 && !JUNK_WORDS.has(s.toLowerCase())
    );

    if (cleanStack.length === 0) {
      return [
        'Developed core application features improving user experience',
        'Implemented efficient data processing pipeline',
        'Built responsive UI components with clean, maintainable code'
      ].slice(0, count);
    }

    const bullets = [];
    
    const TEMPLATES = [
      (s, m) => `Developed ${s} features enhancing user experience by ${m}%`,
      (s, m) => `Implemented ${s}-based architecture improving scalability and performance`,
      (s, m) => `Integrated ${s} reducing application load time by ${m}%`,
      (s, m) => `Built ${s} module handling 5K+ concurrent users with 99.9% uptime`,
    ];

    for (let i = 0; i < count && i < cleanStack.length; i++) {
      const skill = cleanStack[i];
      const metric = 20 + Math.floor(Math.random() * 40);
      bullets.push(TEMPLATES[i % TEMPLATES.length](skill, metric));
    }

    return bullets;
  }

  /**
   * Generate default education
   */
  generateDefaultEducation() {
    return [{
      institution: '[Your University]',
      degree: 'Bachelor of Technology',
      field: 'Computer Science',
      startDate: '[Start Year]',
      endDate: '[End Year]',
      grade: '[Your GPA/Percentage]',
      location: '[City, State]'
    }];
  }
}

module.exports = new ResumeGenerator();