const { buildSearchableResumeText } = require('./atsScoreCalculator');

const SKILL_SYNONYMS = {
  'nodejs': ['node', 'node.js', 'node js'],
  'javascript': ['js'], 'typescript': ['ts'],
  'postgresql': ['postgres', 'pg', 'psql'],
  'mongodb': ['mongo', 'mongodb atlas'],
  'kubernetes': ['k8s', 'k8'], 'reactjs': ['react', 'react.js'],
  'express': ['expressjs', 'express.js'],
  'rest api': ['rest', 'restful', 'rest apis'],
  'aws': ['amazon web services'], 'docker': ['docker container'],
  'ci/cd': ['cicd', 'continuous integration'], 'graphql': ['graph ql'],
};

const HARD_SKILL_TERMS = new Set([
  'javascript','typescript','python','java','golang','rust','c++','c#',
  'nodejs','node.js','reactjs','react','angular','vue','svelte','nextjs',
  'express','fastapi','django','spring','rails','laravel',
  'mongodb','postgresql','mysql','redis','elasticsearch','dynamodb',
  'graphql','rest api','grpc','websockets','docker','kubernetes','k8s',
  'aws','gcp','azure','terraform','ansible','helm','git','github','gitlab',
  'ci/cd','linux','bash','nginx','apache','machine learning','deep learning',
  'pytorch','tensorflow','pandas','numpy','sql','nosql','microservices',
  'kafka','rabbitmq','socketio',
]);

const countOccurrences = (text, sub) => {
  let count = 0, pos = 0;
  while (true) { pos = text.indexOf(sub, pos); if (pos !== -1) { count++; pos += sub.length; } else break; }
  return count;
};

const getSkillSynonyms = (kw) => {
  const lower = kw.toLowerCase();
  if (SKILL_SYNONYMS[lower]) return SKILL_SYNONYMS[lower];
  for (const [key, vals] of Object.entries(SKILL_SYNONYMS)) {
    if (key === lower || vals.includes(lower)) return [key, ...vals].filter(x => x !== lower);
  }
  return [];
};

const buildSectionBlocks = (resume) => ({
  summary: (resume.summary || '').toLowerCase(),
  skills: (() => {
    const p = [];
    (resume.skills || []).forEach(s => { if (s.items) p.push(...s.items); else if (typeof s === 'string') p.push(s); });
    return p.join(' ').toLowerCase();
  })(),
  projects: (() => {
    const p = [];
    (resume.projects || []).forEach(proj => {
      if (proj.title) p.push(proj.title); if (proj.name) p.push(proj.name);
      if (proj.description) p.push(proj.description);
      if (proj.techStack) p.push(...(proj.techStack || []));
      if (proj.bullets) p.push(...(proj.bullets || []));
    });
    return p.join(' ').toLowerCase();
  })(),
  experience: (() => {
    const p = [];
    (resume.experience || []).forEach(e => {
      if (e.role) p.push(e.role); if (e.company) p.push(e.company);
      if (e.bullets) p.push(...(e.bullets || []));
    });
    return p.join(' ').toLowerCase();
  })(),
});

/**
 * Unified Resume Analysis Engine
 */
function analyzeResume(resume, jd) {
  if (!resume || !jd) {
    return { valid: false, matchedSkills: [], missingSkills: [], matchPercentage: 0 };
  }

  const keywordsRaw = jd.extractedKeywords || jd.keywords || [];
  const validKeywords = (Array.isArray(keywordsRaw) ? keywordsRaw : [])
    .map(k => typeof k === 'string' ? k : (k.keyword || '')).filter(Boolean);

  if (validKeywords.length === 0) {
    return { valid: false, matchedSkills: [], missingSkills: [], matchPercentage: 0 };
  }

  const sectionBlocks = buildSectionBlocks(resume);
  const matchedSkills = [], missingSkills = [];
  let totalWeight = 0, earnedWeight = 0;

  validKeywords.forEach(rawKw => {
    const isObj = typeof rawKw === 'object';
    const kwString = isObj ? (rawKw.keyword || rawKw.name || '') : String(rawKw);
    const kwBaseWeight = isObj && rawKw.weight ? rawKw.weight : 1;
    const lowerKw = kwString.toLowerCase();

    let matchType = null, frequency = 0;
    const sections = [];

    // Exact section-by-section match
    for (const [sectionName, sectionText] of Object.entries(sectionBlocks)) {
      const cnt = countOccurrences(sectionText, lowerKw);
      if (cnt > 0) { if (!matchType) matchType = 'exact'; frequency += cnt; sections.push(sectionName); }
    }

    // Synonym fallback
    if (!matchType) {
      for (const syn of getSkillSynonyms(kwString)) {
        for (const [sectionName, sectionText] of Object.entries(sectionBlocks)) {
          const cnt = countOccurrences(sectionText, syn);
          if (cnt > 0) { matchType = 'synonym'; frequency += cnt; if (!sections.includes(sectionName)) sections.push(sectionName); }
        }
      }
    }

    const confidence = Math.min(1, parseFloat((frequency / 3).toFixed(2)));
    let weightFactor = kwBaseWeight;
    if (frequency > 2) weightFactor += 1;
    totalWeight += weightFactor;

    if (matchType) {
      earnedWeight += weightFactor;
      matchedSkills.push({ keyword: kwString, matchType, frequency, confidence, sections, weightApplied: weightFactor });
    } else {
      missingSkills.push({ keyword: kwString, type: HARD_SKILL_TERMS.has(lowerKw) ? 'hard' : 'context', weight: weightFactor });
    }
  });

  const matchPercentage = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  const missingHardCount = missingSkills.filter(s => s.type === 'hard').length;
  const predictedScore = totalWeight > 0
    ? Math.min(100, Math.round(((earnedWeight + missingHardCount) / totalWeight) * 100))
    : matchPercentage;

  return {
    valid: true,
    matchedSkills,
    missingSkills,
    matchPercentage,
    predictedScore,
    totalKeywords: validKeywords.length,
    matchedCount: matchedSkills.length,
    missingCount: missingSkills.length
  };
}

module.exports = {
  analyzeResume
};
