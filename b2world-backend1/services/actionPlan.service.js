const { analyzeResume } = require('./analysisEngine');

// Core Priority Mapping
const CORE_BACKEND = ['node.js', 'system design', 'rest api', 'express.js', 'mongodb', 'postgresql', 'aws', 'docker', 'kubernetes', 'microservices', 'graphql', 'caching', 'redis'];
const CORE_FRONTEND = ['react', 'react.js', 'next.js', 'typescript', 'javascript', 'vue', 'angular', 'state management', 'redux'];

const IMPACT_WEIGHTS = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0.5
};

/**
 * Determine impact of a missing skill based on role context
 */
const determineImpact = (skillLower, roleLower) => {
  if (roleLower.includes('backend') && CORE_BACKEND.includes(skillLower)) return 'high';
  if (roleLower.includes('frontend') && CORE_FRONTEND.includes(skillLower)) return 'high';
  if (CORE_BACKEND.includes(skillLower) || CORE_FRONTEND.includes(skillLower)) return 'medium';
  return 'low';
};

/**
 * Construct actionable steps organically without an LLM for speed, 
 * or you can integrate an LLM if one is loaded.
 */
const generateAction = (skill, impact) => {
  const sk = skill.toLowerCase();
  
  if (['system design', 'microservices'].includes(sk)) {
    return { 
      reason: "Required for backend scalability roles",
      action: "Build a scalable URL shortener with load balancing",
      boost: 12
    };
  }
  if (sk.includes('rest api') || sk.includes('express') || sk.includes('node.js')) {
    return {
      reason: "Core fundamental for exposing data layers securely",
      action: "Develop a robust CRUD API featuring JWT authentication",
      boost: 15
    };
  }
  if (sk.includes('react') || sk.includes('next.js')) {
    return {
      reason: "Standard expectation for modern interactive UIs",
      action: "Create a dashboard using Context API / State Management",
      boost: 10
    };
  }
  if (sk.includes('docker') || sk.includes('kubernetes')) {
    return {
      reason: "Essential for modern deployment pipelines",
      action: "Containerize a small node app and deploy via Docker Compose",
      boost: 8
    };
  }
  
  // Generic fallback
  return {
    reason: `Requested skill for improved technical alignment`,
    action: `Build a small proof-of-concept project integrating ${skill}`,
    boost: impact === 'high' ? 8 : (impact === 'medium' ? 5 : 2)
  };
};

/**
 * Transforms missing skills into ordered Next Best Actions
 */
const generateActionPlan = (missingSkillsArray, detectedRole = '') => {
  const role = detectedRole.toLowerCase();

  const rawActions = missingSkillsArray.map(m => {
    const skillName = typeof m === 'object' ? (m.keyword || m.name) : m;
    const skillLower = skillName.toLowerCase();
    
    // Calculate impact
    let impact = determineImpact(skillLower, role);
    // Let's promote Context/Hard type if provided by analysisEngine
    if (m.type === 'hard' && impact === 'low') impact = 'medium';
    
    // Format JSON
    const actionData = generateAction(skillName, impact);

    return {
      skill: skillName,
      impact: impact,
      impact_weight: IMPACT_WEIGHTS[impact],
      reason: actionData.reason,
      action: actionData.action,
      expected_score_boost: actionData.boost
    };
  });

  // Top 3 Filtering via sort
  return rawActions
    .sort((a, b) => b.impact_weight - a.impact_weight)
    .slice(0, 3)
    .map(obj => {
      // Clean up internal property
      delete obj.impact_weight;
      return obj;
    });
};

/**
 * Hiring Signals Engine
 */
const extractHiringSignals = (resume, jd, missingSkills) => {
  const signals = new Set();
  
  const hasExperience = resume.experience && resume.experience.length > 0;
  const projectCount = resume.projects ? resume.projects.length : 0;
  
  if (hasExperience) signals.add("industry-proven");
  if (projectCount >= 3) signals.add("builder-mentality");

  // Check for depth based on found text
  let combinedText = [
    resume.summary || '',
    ...(resume.experience || []).map(p => (p.bullets || []).join(' ')),
    ...(resume.projects || []).map(p => (p.bullets || []).join(' '))
  ].join(' ').toLowerCase();

  if (combinedText.includes('scale') || combinedText.includes('performance') || combinedText.includes('latency')) {
    signals.add('scalability');
  }
  if (combinedText.includes('deploy') || combinedText.includes('aws') || combinedText.includes('ci/cd')) {
    signals.add('devops-exposure');
  }
  if (combinedText.includes('database') || combinedText.includes('sql') || combinedText.includes('mongo')) {
    signals.add('backend-depth');
  }
  if (combinedText.includes('user') || combinedText.includes('ui/ux') || combinedText.includes('responsive')) {
    signals.add('front-end-focused');
  }

  // Remove missing skills if they contradict signals
  const missings = missingSkills.map(m => (typeof m === 'object' ? m.keyword : m).toLowerCase());
  if (missings.includes('system design') || missings.includes('aws')) signals.delete('scalability');

  return Array.from(signals).slice(0, 4); // Max 4 top-level signals
};

module.exports = {
  generateActionPlan,
  extractHiringSignals
};
