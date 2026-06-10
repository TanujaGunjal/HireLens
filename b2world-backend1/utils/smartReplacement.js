/**
 * ================================================================================
 * SMART TEXT REPLACEMENT UTILITY
 * ================================================================================
 * Intelligently replaces weak starters with strong verbs
 * Does NOT prepend - replaces entire weak phrase
 */

// Weak starter patterns → replacement logic
const WEAK_STARTER_REPLACEMENTS = {
  'worked on': 'Developed',
  'worked with': 'Collaborated with',
  'worked for': 'Supported',
  'responsible for': 'Led',
  'handled': 'Managed',
  'helped': 'Improved',
  'helped with': 'Enhanced',
  'assisted': 'Supported and improved',
  'assisted with': 'Optimized',
  'used': 'Leveraged',
  'made': 'Created and implemented',
  'did': 'Executed',
  'was responsible': 'Owned',
  'was involved': 'Contributed to',
  'involved in': 'Contributed to',
  'participated in': 'Led efforts in',
  'took part in': 'Contributed to',
  'as part of': 'Through collaboration,',
  'was part of': 'Spearheaded within',
  'contributed to': 'Architected',
  'etc.': '',
  'and more': '',
  'things like': '',
  'for example': '',
  'and so on': ''
};

/**
 * Intelligently replace weak bullet starters
 * 
 * Examples:
 * "Handled data cleaning" → "Performed data cleaning and preprocessing"
 * "Worked with team" → "Collaborated with cross-functional team"
 * "Responsible for API design" → "Led API design and implementation"
 */
const smartReplaceBullet = (bullet) => {
  if (!bullet || typeof bullet !== 'string') return bullet;
  
  const trimmed = bullet.trim();
  const lower = trimmed.toLowerCase();
  
  // Try exact prefix matches (longest first to avoid partial matches)
  const sortedPatterns = Object.keys(WEAK_STARTER_REPLACEMENTS).sort((a, b) => b.length - a.length);
  
  for (const pattern of sortedPatterns) {
    if (lower.startsWith(pattern)) {
      const replacement = WEAK_STARTER_REPLACEMENTS[pattern];
      const rest = trimmed.substring(pattern.length).trim();
      
      // Build improved text
      let improved;
      if (replacement === '') {
        // For patterns like "etc.", just remove them
        improved = trimmed.substring(0, trimmed.length - pattern.length).trim();
      } else {
        // Capitalize replacement if it's a new sentence starter
        const replacementCapitalized = replacement.charAt(0).toUpperCase() + replacement.slice(1);
        improved = `${replacementCapitalized}${rest ? ' ' + rest : ''}`;
      }
      
      return improved || trimmed; // Return original if replacement results in empty
    }
  }
  
  // No pattern matched - return original
  return trimmed;
};

/**
 * Check if a bullet already starts with a strong action verb
 */
const startsWithStrongVerb = (bullet, strongVerbs) => {
  if (!bullet) return false;
  const first = bullet.trim().toLowerCase().split(/\s+/)[0];
  return strongVerbs.has(first);
};

/**
 * Remove duplicate/filler text
 */
const cleanImprovedText = (text = '') => {
  if (!text || typeof text !== 'string') return '';
  
  let cleaned = text
    .replace(/\s*[—\-–]\s*add\s+(?:a\s+)?(?:measurable\s+)?(?:outcome|impact|metric)[^.]*\.?$/i, '')
    .replace(/\s*[—\-–]\s*consider\s+adding[^.]*\.?$/i, '')
    .replace(/\s*[—\-–]\s*quantify\s+(?:your\s+)?(?:the\s+)?(?:impact|result|outcome)[^.]*\.?$/i, '')
    .replace(/\s*\(e\.g\.,?[^)]{0,120}\)\s*\.?$/i, '')
    .replace(/,?\s*currently\s+\d+[^,]*,?\s*target\s+\d+\+?\.?$/i, '')
    .replace(/\s+(?:make|strong|do|be|get)\s+(?:logic|sense|code|better|stronf|stonf)[^.]*\.?$/i, '')
    .replace(/\s*[—\-–]\s*$/, '')
    .trim();
  
  return cleaned || text; // Return original if cleaning results in empty string
};

/**
 * Validate improved text
 */
const validateImprovedText = (original, improved) => {
  // Should not be empty
  if (!improved || improved.trim().length === 0) return false;
  
  // Should be different from original (with some tolerance for case/whitespace)
  const normalize = (str) => str.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalize(original) === normalize(improved)) return false;
  
  return true;
};

module.exports = {
  smartReplaceBullet,
  startsWithStrongVerb,
  cleanImprovedText,
  validateImprovedText,
  WEAK_STARTER_REPLACEMENTS
};
