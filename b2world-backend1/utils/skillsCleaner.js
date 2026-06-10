/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SKILLS CLEANER - Extract and Clean Technical Skills
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Problem: Resume parser sometimes places sentences in skills list
 * Example: "JavaScript, HTML, CSS, Assisted in web tools"
 * 
 * Solution: Detect and remove non-skill sentences, return them as experience bullets
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Common technical skill patterns (not sentences)
const TECH_SKILL_PATTERN = /^[a-z0-9\s\/#\+\-\(\)\.]+$/i;
const SENTENCE_INDICATORS = [
  'assisted', 'developed', 'created', 'built', 'managed', 'led',
  'implemented', 'designed', 'worked', 'contributed', 'helped',
  'improved', 'optimized', 'automated', 'deployed', 'integrated',
  'developed', 'engineered', 'architected', 'maintained'
];

// Common technology names (single words/short phrases)
const KNOWN_TECHS = new Set([
  'javascript', 'typescript', 'python', 'java', 'golang', 'rust', 'c++', 'c#',
  'html', 'css', 'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt',
  'express', 'django', 'flask', 'fastapi', 'spring', 'laravel', 'rails',
  'mongodb', 'postgres', 'mysql', 'redis', 'firestore', 'dynamodb',
  'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'heroku',
  'git', 'github', 'gitlab', 'bitbucket', 'jenkins', 'circleci',
  'sql', 'nosql', 'graphql', 'rest', 'api', 'webgl', 'node.js',
  'jquery', 'bootstrap', 'tailwind', 'sass', 'less', 'webpack',
  'git', 'npm', 'yarn', 'pip', 'maven', 'gradle',
  'jira', 'slack', 'confluence', 'trello', 'asana',
  'figma', 'sketch', 'adobe', 'photoshop', 'illustrator',
  'agile', 'scrum', 'kanban', 'ci/cd', 'tdd', 'bdd',
  'linux', 'windows', 'macos', 'ios', 'android',
  'ml', 'ai', 'nlp', 'opencv', 'tensorflow', 'pytorch'
]);

/**
 * Check if a string looks like a skill (not a sentence)
 * @param {string} text - Text to check
 * @returns {boolean} - True if text appears to be a skill name
 */
const isSkill = (text) => {
  if (!text || typeof text !== 'string') return false;
  
  const trimmed = text.trim().toLowerCase();
  const words = trimmed.split(/\s+/);
  
  // Skills are typically 1-3 words
  if (words.length > 4) return false;
  
  // Check if contains sentence indicators
  const hasSentenceIndicator = SENTENCE_INDICATORS.some(ind => 
    trimmed.includes(ind)
  );
  
  if (hasSentenceIndicator) return false;
  
  // Check for punctuation (sentences often have periods, commas at end)
  if (trimmed.endsWith('.') || trimmed.endsWith(',') || trimmed.endsWith(';')) {
    return false;
  }
  
  // Check if first word is a known tech or looks like tech name
  const firstWord = words[0];
  if (KNOWN_TECHS.has(firstWord)) return true;
  
  // Check if it matches tech skill pattern (alphanumeric + symbols)
  if (TECH_SKILL_PATTERN.test(trimmed)) return true;
  
  return false;
};

/**
 * Split a skills list by comma and identify valid skills vs sentences
 * @param {string|array} skillsInput - Raw skills input (comma-separated string or array)
 * @returns {object} - { validSkills: string[], sentences: string[] }
 */
const cleanSkillsList = (skillsInput) => {
  const validSkills = [];
  const sentences = [];
  
  if (!skillsInput) return { validSkills, sentences };
  
  // Convert to array if string
  let items = Array.isArray(skillsInput) 
    ? skillsInput 
    : skillsInput.split(',');
  
  items.forEach(item => {
    if (!item) return;
    
    const trimmed = item.trim();
    if (trimmed.length === 0) return;
    
    if (isSkill(trimmed)) {
      validSkills.push(trimmed);
    } else {
      sentences.push(trimmed);
    }
  });
  
  return { validSkills, sentences };
};

/**
 * Clean resume skills section and extract any experience sentences
 * @param {object} resume - Resume object
 * @returns {object} - Modified resume with cleaned skills and extracted experience
 */
const cleanResumeSkills = (resume) => {
  if (!resume) return resume;
  
  const cleaned = { ...resume };
  
  // Handle skills as array of objects
  if (cleaned.skills && Array.isArray(cleaned.skills)) {
    const allSentences = [];
    
    cleaned.skills = cleaned.skills.map(skillSection => {
      // If it's a string (simple format)
      if (typeof skillSection === 'string') {
        const { validSkills, sentences } = cleanSkillsList(skillSection);
        allSentences.push(...sentences);
        return validSkills.join(', ');
      }
      
      // If it's an object with items array
      if (skillSection.items && Array.isArray(skillSection.items)) {
        const allItems = skillSection.items.join(', ');
        const { validSkills, sentences } = cleanSkillsList(allItems);
        allSentences.push(...sentences);
        
        return {
          ...skillSection,
          items: validSkills
        };
      }
      
      // Return as-is if can't process
      return skillSection;
    });
    
    // Add extracted sentences to experience as suggestions
    if (allSentences.length > 0) {
      cleaned._extractedExperienceSentences = allSentences;
      console.log(`🔧 Skills Cleaner: Extracted ${allSentences.length} experience sentences from skills`);
    }
  }
  
  return cleaned;
};

/**
 * Create experience suggestions from extracted sentences
 * @param {array} sentences - Extracted sentences from skills
 * @param {number} experienceIndex - Index in experience array
 * @returns {array} - Array of suggestion objects
 */
const createExperienceSuggestionsFromSentences = (sentences, experienceIndex = 0) => {
  if (!sentences || sentences.length === 0) return [];
  
  return sentences.map((sentence, i) => ({
    id: `sugg-extracted-${i}`,
    type: 'content',
    section: 'experience',
    itemIndex: experienceIndex,
    bulletIndex: undefined,
    originalText: '',
    improvedText: sentence,
    impact: 'medium',
    reason: 'This item was extracted from the Technical Skills section.',
    title: 'Add to experience description',
    confidence: 0.75,
    actionable: true
  }));
};

module.exports = {
  isSkill,
  cleanSkillsList,
  cleanResumeSkills,
  createExperienceSuggestionsFromSentences
};
