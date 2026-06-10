/**
 * Generic Industry Mode Service
 * Provides scoring when no Job Description is provided
 * Uses role-based keyword library
 * 
 * File: b2world-backend1/services/genericModeService.js
 */

class GenericModeService {
  /**
   * Score resume in generic mode (no JD provided)
   * Detects role from resume and scores against industry standards
   */
  generateGenericScore(resume, atsScorer) {
    // Step 1: Detect role from resume
    const detectedRole = this._detectRole(resume);
    
    // Step 2: Get role-specific keywords
    const roleKeywords = this._getRoleKeywords(detectedRole);
    
    // Step 3: Score against role keywords
    const score = atsScorer.calculateScore(resume, roleKeywords, detectedRole);
    
    // Step 4: Add context for generic mode
    return {
      ...score,
      generic: true,
      detectedRole,
      comparison: {
        benchmark: this._getBenchmarks(detectedRole),
        percentile: this._calculatePercentile(score.totalScore, detectedRole),
      }
    };
  }

  /**
   * Detect role from resume content
   */
  _detectRole(resume) {
    const roleIndicators = {
      'software_engineer': {
        keywords: ['developer', 'engineer', 'software', 'programmer', 'code', 'javascript', 'python'],
        weight: 1.0
      },
      'frontend_engineer': {
        keywords: ['frontend', 'react', 'vue', 'angular', 'ui', 'ux', 'css', 'javascript'],
        weight: 1.1  // Higher priority than generic software engineer
      },
      'backend_engineer': {
        keywords: ['backend', 'server', 'api', 'database', 'node.js', 'java', 'python', 'devops'],
        weight: 1.1
      },
      'full_stack_developer': {
        keywords: ['full stack', 'frontend', 'backend', 'database'],
        weight: 1.0
      },
      'data_engineer': {
        keywords: ['data', 'sql', 'spark', 'hadoop', 'etl', 'analytics', 'kafka'],
        weight: 1.0
      },
      'product_manager': {
        keywords: ['product', 'management', 'strategy', 'roadmap', 'user research'],
        weight: 1.0
      },
      'ux_designer': {
        keywords: ['design', 'ux', 'ui', 'figma', 'user research', 'prototyping'],
        weight: 1.0
      },
      'qa_engineer': {
        keywords: ['qa', 'testing', 'automation', 'selenium', 'test', 'quality'],
        weight: 1.0
      },
      'devops_engineer': {
        keywords: ['devops', 'docker', 'kubernetes', 'ci/cd', 'aws', 'infrastructure'],
        weight: 1.0
      },
    };

    const resumeText = this._buildResumeText(resume).toLowerCase();
    let detectedRole = 'software_engineer'; // Default
    let maxScore = 0;

    for (const [role, config] of Object.entries(roleIndicators)) {
      let score = 0;
      for (const keyword of config.keywords) {
        if (resumeText.includes(keyword)) {
          score += config.weight;
        }
      }

      if (score > maxScore) {
        maxScore = score;
        detectedRole = role;
      }
    }

    return detectedRole;
  }

  /**
   * Get role-specific keyword library
   */
  _getRoleKeywords(role) {
    const roleKeywordLibrary = {
      'software_engineer': [
        { keyword: 'programming', importance: 'Critical', category: 'skill' },
        { keyword: 'algorithms', importance: 'Critical', category: 'skill' },
        { keyword: 'data structures', importance: 'Critical', category: 'skill' },
        { keyword: 'object oriented programming', importance: 'Important', category: 'skill' },
        { keyword: 'design patterns', importance: 'Important', category: 'skill' },
        { keyword: 'git', importance: 'Critical', category: 'tool' },
        { keyword: 'testing', importance: 'Important', category: 'practice' },
        { keyword: 'unit test', importance: 'Important', category: 'practice' },
        { keyword: 'code review', importance: 'Important', category: 'practice' },
        { keyword: 'agile', importance: 'Important', category: 'practice' },
        { keyword: 'debugging', importance: 'Important', category: 'practice' },
      ],
      
      'frontend_engineer': [
        { keyword: 'react', importance: 'Critical', category: 'framework' },
        { keyword: 'javascript', importance: 'Critical', category: 'language' },
        { keyword: 'css', importance: 'Critical', category: 'skill' },
        { keyword: 'html', importance: 'Critical', category: 'language' },
        { keyword: 'responsive design', importance: 'Important', category: 'skill' },
        { keyword: 'ui components', importance: 'Important', category: 'skill' },
        { keyword: 'state management', importance: 'Important', category: 'skill' },
        { keyword: 'typescript', importance: 'Important', category: 'language' },
        { keyword: 'rest api', importance: 'Important', category: 'skill' },
        { keyword: 'webpack', importance: 'Nice_to_have', category: 'tool' },
        { keyword: 'performance optimization', importance: 'Important', category: 'skill' },
      ],
      
      'backend_engineer': [
        { keyword: 'rest api', importance: 'Critical', category: 'skill' },
        { keyword: 'database', importance: 'Critical', category: 'skill' },
        { keyword: 'sql', importance: 'Critical', category: 'language' },
        { keyword: 'node.js', importance: 'Critical', category: 'framework' },
        { keyword: 'server side', importance: 'Critical', category: 'skill' },
        { keyword: 'microservices', importance: 'Important', category: 'architecture' },
        { keyword: 'mongodb', importance: 'Important', category: 'tool' },
        { keyword: 'scaling', importance: 'Important', category: 'skill' },
        { keyword: 'concurrency', importance: 'Important', category: 'skill' },
        { keyword: 'authentication', importance: 'Important', category: 'skill' },
      ],
      
      'full_stack_developer': [
        { keyword: 'react', importance: 'Critical', category: 'framework' },
        { keyword: 'node.js', importance: 'Critical', category: 'framework' },
        { keyword: 'javascript', importance: 'Critical', category: 'language' },
        { keyword: 'rest api', importance: 'Critical', category: 'skill' },
        { keyword: 'database', importance: 'Critical', category: 'skill' },
        { keyword: 'mongodb', importance: 'Important', category: 'tool' },
        { keyword: 'html', importance: 'Important', category: 'language' },
        { keyword: 'css', importance: 'Important', category: 'skill' },
        { keyword: 'git', importance: 'Important', category: 'tool' },
        { keyword: 'deployment', importance: 'Important', category: 'practice' },
      ],
      
      'data_engineer': [
        { keyword: 'sql', importance: 'Critical', category: 'language' },
        { keyword: 'etl', importance: 'Critical', category: 'skill' },
        { keyword: 'data pipeline', importance: 'Critical', category: 'skill' },
        { keyword: 'apache spark', importance: 'Important', category: 'tool' },
        { keyword: 'hadoop', importance: 'Important', category: 'tool' },
        { keyword: 'big data', importance: 'Important', category: 'skill' },
        { keyword: 'data warehouse', importance: 'Important', category: 'skill' },
        { keyword: 'kafka', importance: 'Important', category: 'tool' },
        { keyword: 'airflow', importance: 'Important', category: 'tool' },
        { keyword: 'python', importance: 'Important', category: 'language' },
      ],

      'product_manager': [
        { keyword: 'product strategy', importance: 'Critical', category: 'skill' },
        { keyword: 'roadmap', importance: 'Critical', category: 'skill' },
        { keyword: 'user research', importance: 'Critical', category: 'skill' },
        { keyword: 'requirements', importance: 'Important', category: 'skill' },
        { keyword: 'stakeholder management', importance: 'Important', category: 'skill' },
        { keyword: 'analytics', importance: 'Important', category: 'skill' },
        { keyword: 'agile', importance: 'Important', category: 'practice' },
        { keyword: 'metrics', importance: 'Important', category: 'skill' },
        { keyword: 'prototyping', importance: 'Nice_to_have', category: 'skill' },
      ],

      'ux_designer': [
        { keyword: 'user interface design', importance: 'Critical', category: 'skill' },
        { keyword: 'user experience', importance: 'Critical', category: 'skill' },
        { keyword: 'figma', importance: 'Critical', category: 'tool' },
        { keyword: 'prototyping', importance: 'Important', category: 'skill' },
        { keyword: 'user research', importance: 'Important', category: 'skill' },
        { keyword: 'wireframing', importance: 'Important', category: 'skill' },
        { keyword: 'adobe xd', importance: 'Important', category: 'tool' },
        { keyword: 'usability testing', importance: 'Important', category: 'practice' },
        { keyword: 'design system', importance: 'Important', category: 'skill' },
      ],
    };

    return roleKeywordLibrary[role] || roleKeywordLibrary['software_engineer'];
  }

  /**
   * Get industry benchmarks for role
   */
  _getBenchmarks(role) {
    const benchmarks = {
      'software_engineer': {
        avgScore: 72,
        excellentScore: 85,
        goodScore: 75,
      },
      'frontend_engineer': {
        avgScore: 70,
        excellentScore: 83,
        goodScore: 73,
      },
      'backend_engineer': {
        avgScore: 73,
        excellentScore: 85,
        goodScore: 75,
      },
      'full_stack_developer': {
        avgScore: 71,
        excellentScore: 84,
        goodScore: 74,
      },
      'data_engineer': {
        avgScore: 69,
        excellentScore: 82,
        goodScore: 72,
      },
      'product_manager': {
        avgScore: 68,
        excellentScore: 80,
        goodScore: 70,
      },
      'ux_designer': {
        avgScore: 67,
        excellentScore: 79,
        goodScore: 69,
      },
    };

    return benchmarks[role] || benchmarks['software_engineer'];
  }

  /**
   * Calculate percentile score
   */
  _calculatePercentile(score, role) {
    const benchmark = this._getBenchmarks(role);
    
    if (score >= benchmark.excellentScore) {
      return { percentile: 'top_15', label: 'Excellent' };
    } else if (score >= benchmark.goodScore) {
      return { percentile: 'top_40', label: 'Good' };
    } else if (score >= benchmark.avgScore) {
      return { percentile: 'top_60', label: 'Average' };
    } else {
      return { percentile: 'below_avg', label: 'Needs Work' };
    }
  }

  _buildResumeText(resume) {
    const parts = [
      resume.personalInfo?.fullName || '',
      resume.personalInfo?.jobTitle || '',
      resume.summary || '',
      (resume.skills || []).flatMap(s => s.items).join(' '),
      (resume.experience || []).flatMap(e => [e.role, e.company, ...(e.bullets || [])]).join(' '),
    ];
    
    return parts.filter(Boolean).join(' ');
  }
}

module.exports = GenericModeService;
