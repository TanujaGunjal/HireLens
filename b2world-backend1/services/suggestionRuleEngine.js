/**
 * ================================================================================
 * SUGGESTION RULE ENGINE - Professional Suggestion Generation
 * ================================================================================
 * Rule-based, intelligent suggestion system
 * - Contextual suggestions based on section
 * - Weak verb detection and rewriting
 * - Measurable impact injection
 * - Automatic deduplication
 * - No LLM/OpenAI dependency
 * ================================================================================
 */

const rewriteRules = require('../utils/rewriteRules');

class SuggestionRuleEngine {
  constructor() {
    this.seenSuggestions = new Set(); // Track suggestions for deduplication
  }

  /**
   * Reset deduplication tracker (call between resume evaluations)
   */
  reset() {
    this.seenSuggestions = new Set();
  }

  /**
   * Check if suggestion already exists (avoid duplicates)
   * @param {string} section
   * @param {string} originalText
   * @param {string} type
   * @returns {boolean}
   */
  isDuplicate(section, originalText, type) {
    const key = rewriteRules.createSuggestionKey(section, originalText, type);
    return this.seenSuggestions.has(key);
  }

  /**
   * Mark suggestion as seen
   * @param {string} section
   * @param {string} originalText
   * @param {string} type
   */
  markSeen(section, originalText, type) {
    const key = rewriteRules.createSuggestionKey(section, originalText, type);
    this.seenSuggestions.add(key);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 1. MISSING KEYWORD SUGGESTIONS
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * Generate suggestion for missing keyword in skills section
   * @param {string} keyword
   * @returns {object} Structured suggestion
   */
  suggestKeywordInSkills(keyword) {
    // Use keyword itself as the dedup key so each missing keyword gets its own suggestion
    if (this.isDuplicate('skills', keyword, 'keyword_missing')) return null;
    this.markSeen('skills', keyword, 'keyword_missing');

    return {
      id: `sugg-keyword-${keyword.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'keyword_missing',
      section: 'skills',
      itemIndex: 0,
      bulletIndex: undefined,
      originalText: '',
      improvedText: keyword,
      impact: 'high',
      reason: `"${keyword}" is mentioned in the job description and is critical for ATS matching`,
      title: `Add missing keyword: ${keyword}`,
      confidence: 0.95,
      actionable: true
    };
  }

  /**
   * Generate suggestion for missing keyword in experience section
   * CONTEXTUAL: Rewrite a bullet to include the keyword naturally
   * @param {string} keyword
   * @param {array} bullets - Experience bullets to potentially rewrite
   * @param {number} itemIndex - Which experience entry
   * @returns {object|null} Structured suggestion or null if no good rewrite
   */
  suggestKeywordInExperience(keyword, bullets = [], itemIndex = 0) {
    if (!bullets || !Array.isArray(bullets) || bullets.length === 0) {
      return null;
    }

    if (this.isDuplicate('experience', keyword, 'keyword_missing')) return null;

    // Find best bullet to rewrite (weak one, has some length)
    let bestBullet = null;
    let bestIdx = 0;

    for (let i = 0; i < bullets.length; i++) {
      const bullet = String(bullets[i]).trim();
      if (!bullet || bullet.length < 10) continue;

      const analysis = rewriteRules.analyzeBullet(bullet);
      if (analysis.weakPoints.length > 0) {
        bestBullet = bullet;
        bestIdx = i;
        break;
      }
    }

    // Fall back to first reasonable bullet
    if (!bestBullet) {
      bestBullet = String(bullets[0]).trim();
      if (!bestBullet || bestBullet.length < 10) return null;
    }

    // Rewrite bullet with keyword
    const improvedText = rewriteRules.rewriteBulletWithKeyword(keyword, bestBullet);

    if (improvedText === bestBullet) return null; // No improvement

    this.markSeen('experience', keyword, 'keyword_missing');

    return {
      id: `sugg-keyword-exp-${keyword.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'keyword_missing',
      section: 'experience',
      itemIndex: itemIndex,
      bulletIndex: bestIdx,
      originalText: bestBullet,
      improvedText: improvedText,
      impact: 'high',
      reason: `Contextually rewrite this bullet to include "${keyword}" which is important for the role`,
      title: `Strengthen bullet with ${keyword}`,
      confidence: 0.88,
      actionable: true
    };
  }

  /**
   * Generate suggestion for missing keyword in projects section
   * @param {string} keyword
   * @param {array} bullets - Project bullets
   * @param {number} itemIndex - Which project
   * @returns {object|null}
   */
  suggestKeywordInProjects(keyword, bullets = [], itemIndex = 0) {
    if (!bullets || !Array.isArray(bullets) || bullets.length === 0) {
      return null;
    }

    if (this.isDuplicate('projects', keyword, 'keyword_missing')) return null;

    const bestBullet = String(bullets[0]).trim();
    if (!bestBullet || bestBullet.length < 10) return null;

    const improvedText = rewriteRules.rewriteBulletWithKeyword(keyword, bestBullet);

    if (improvedText === bestBullet) return null;

    this.markSeen('projects', keyword, 'keyword_missing');

    return {
      id: `sugg-keyword-proj-${keyword.toLowerCase().replace(/\s+/g, '-')}`,
      type: 'keyword_missing',
      section: 'projects',
      itemIndex: itemIndex,
      bulletIndex: 0,
      originalText: bestBullet,
      improvedText: improvedText,
      impact: 'high',
      reason: `Demonstrate experience with ${keyword} in your project work`,
      title: `Add ${keyword} to project description`,
      confidence: 0.85,
      actionable: true
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 2. WEAK VERB SUGGESTIONS
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * Generate suggestion to fix weak verb in experience bullet
   * @param {string} bullet
   * @param {number} itemIndex
   * @param {number} bulletIndex
   * @returns {object|null}
   */
  suggestStrongerVerb(bullet, itemIndex = 0, bulletIndex = 0) {
    if (!bullet) return null;

    // ✅ GUARD: Skip if already improved (prevents looping suggestions)
    if (!rewriteRules.shouldSuggest(bullet, 'weak_verb')) return null;

    const { isWeak, verb } = rewriteRules.detectWeakVerb(bullet);
    if (!isWeak) return null;

    if (this.isDuplicate('experience', bullet, 'weak_verb')) return null;

    const improvedText = rewriteRules.strengthenBullet(bullet);

    if (improvedText === bullet) return null;

    this.markSeen('experience', bullet, 'weak_verb');

    return {
      id: `sugg-verb-${itemIndex}-${bulletIndex}`,
      type: 'weak_verb',
      section: 'experience',
      itemIndex: itemIndex,
      bulletIndex: bulletIndex,
      originalText: bullet,
      improvedText: improvedText,
      impact: 'high',
      reason: `Replace weak verb "${verb}" with a stronger action verb to increase ATS score`,
      title: `Strengthen action verb`,
      confidence: 0.90,
      actionable: true
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 3. MEASURABLE IMPACT SUGGESTIONS
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * Generate suggestion to add metrics to a bullet
   * @param {string} bullet
   * @param {number} itemIndex
   * @param {number} bulletIndex
   * @returns {object|null}
   */
  suggestAddMetrics(bullet, itemIndex = 0, bulletIndex = 0) {
    if (!bullet) return null;

    // ✅ GUARD: Skip if already improved
    if (!rewriteRules.shouldSuggest(bullet, 'missing_metrics')) return null;

    if (rewriteRules.hasMetrics(bullet)) return null;

    if (this.isDuplicate('experience', bullet, 'missing_metrics')) return null;

    const analysis = rewriteRules.analyzeBullet(bullet);
    if (analysis.weakPoints.length === 0) return null; // Bullet is already strong

    // Get contextual impact (natural, realistic templates - no fake metrics)
    const impact = rewriteRules.getImpactStatement(bullet);
    const improvedText = `${bullet}, ${impact}.`;

    this.markSeen('experience', bullet, 'missing_metrics');

    return {
      id: `sugg-metrics-${itemIndex}-${bulletIndex}`,
      type: 'missing_metrics',
      section: 'experience',
      itemIndex: itemIndex,
      bulletIndex: bulletIndex,
      originalText: bullet,
      improvedText: improvedText,
      impact: 'high',
      reason: 'Add measurable impact to demonstrate meaningful achievements',
      title: 'Add measurable impact to bullet',
      confidence: 0.85,
      actionable: true
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 4. SUMMARY SUGGESTIONS
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * Generate suggestion to add/improve professional summary
   * @param {string} currentSummary
   * @returns {object|null}
   */
  suggestImproveSummary(currentSummary = '') {
    const length = (currentSummary || '').trim().length;

    if (length >= 100) return null; // Consider adequate

    if (this.isDuplicate('summary', currentSummary, 'weak_summary')) return null;

    const improvedText = `Results-driven professional with proven expertise in delivering impactful solutions. Skilled in architecting scalable systems, optimizing performance, and leading high-performing teams. Demonstrated track record of transforming business requirements into robust technical implementations.`;

    this.markSeen('summary', currentSummary, 'weak_summary');

    return {
      id: 'sugg-summary',
      type: 'weak_summary',
      section: 'summary',
      itemIndex: undefined,
      bulletIndex: undefined,
      originalText: currentSummary || '(empty)',
      improvedText: improvedText,
      impact: 'high',
      reason: 'A strong professional summary improves ATS visibility and recruiter engagement',
      title: 'Add/strengthen professional summary',
      confidence: 0.90,
      actionable: true
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 5. BULLET QUALITY SUGGESTIONS
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * Generate comprehensive suggestion for weak bullet
   * Combines verb + metrics + action verb strength
   * @param {string} bullet
   * @param {number} itemIndex
   * @param {number} bulletIndex
   * @returns {object|null}
   */
  suggestImproveWeakBullet(bullet, itemIndex = 0, bulletIndex = 0) {
    if (!bullet) return null;

    // ✅ GUARD: Skip if already improved
    if (!rewriteRules.shouldSuggest(bullet, 'weak_bullet')) return null;

    const analysis = rewriteRules.analyzeBullet(bullet);
    if (analysis.isStrong) return null; // Already strong

    if (this.isDuplicate('experience', bullet, 'weak_bullet')) return null;

    // Improve verb
    let improvedText = rewriteRules.strengthenBullet(bullet);

    // If still no metrics and still short, add generic improvement
    if (!rewriteRules.hasMetrics(improvedText)) {
      const impact = rewriteRules.getImpactStatement(improvedText);
      improvedText = `${improvedText}, ${impact}.`;
    }

    if (improvedText === bullet) return null;

    this.markSeen('experience', bullet, 'weak_bullet');

    return {
      id: `sugg-improve-${itemIndex}-${bulletIndex}`,
      type: 'weak_bullet',
      section: 'experience',
      itemIndex: itemIndex,
      bulletIndex: bulletIndex,
      originalText: bullet,
      improvedText: improvedText,
      impact: 'high',
      reason: `Strengthen this bullet by using a stronger action verb and adding measurable impact`,
      title: 'Strengthen bullet point',
      confidence: 0.88,
      actionable: true
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 6. MAIN PUBLIC METHOD: Generate All Suggestions
   * ═══════════════════════════════════════════════════════════════════════════
   */

  /**
   * Generate all smart suggestions for a resume
   * @param {object} resume - Resume object
   * @param {array} missingKeywords - Keywords from job description not in resume
   * @returns {array} Array of structured suggestions
   */
  generateSuggestions(resume, missingKeywords = []) {
    console.log('🆕 [SuggestionRuleEngine.generateSuggestions] RUNNING NEW RULE-BASED ENGINE');
    console.log(`   Missing Keywords: ${(missingKeywords || []).join(', ') || 'NONE'}`);
    
    this.reset(); // Clear previous suggestions

    const suggestions = [];
    const processedBullets = new Set(); // Track bullets to avoid duplicates ✅

    // ─ 1. Missing Keywords (highest priority) ─
    if (Array.isArray(missingKeywords) && missingKeywords.length > 0) {
      for (const keyword of missingKeywords.slice(0, 5)) {
        // Always suggest adding to Skills first — that's what real ATS tools do.
        // The user already has experience; they need to LIST the skill explicitly.
        const sugg = this.suggestKeywordInSkills(keyword);
        if (sugg) suggestions.push(sugg);
      }
    }

    // ─ 2. Weak Verbs in Experience ─
    // ✅ FIXED: Track processed bullets to avoid multiple suggestions for same bullet
    if (resume.experience && Array.isArray(resume.experience)) {
      for (let i = 0; i < resume.experience.length; i++) {
        const exp = resume.experience[i];
        if (!exp.bullets || !Array.isArray(exp.bullets)) continue;

        for (let j = 0; j < Math.min(exp.bullets.length, 2); j++) { // Check first 2 bullets
          const bullet = exp.bullets[j];
          const bulletKey = `${i}-${j}`; // Unique key for this bullet
          
          if (processedBullets.has(bulletKey)) continue; // Skip if already processed
          processedBullets.add(bulletKey);

          // Try weak verb suggestion first
          let sugg = this.suggestStrongerVerb(bullet, i, j);
          if (sugg) {
            suggestions.push(sugg);
            processedBullets.add(bulletKey); // ✅ Mark bullet as processed
            if (suggestions.length >= 5) break; // Limit total suggestions
            continue; // Move to next bullet (don't create duplicate suggestions)
          }
          
          // Fall back to general improvement (but not if verb was already suggested)
          sugg = this.suggestImproveWeakBullet(bullet, i, j);
          if (sugg) {
            suggestions.push(sugg);
            if (suggestions.length >= 5) break;
          }
        }
        if (suggestions.length >= 5) break;
      }
    }

    // ─ 3. Missing Metrics ─
    // ✅ FIXED: Only suggest metrics for bullets NOT already modified by verb improvement
    if (resume.experience && Array.isArray(resume.experience) && suggestions.length < 5) {
      for (let i = 0; i < resume.experience.length; i++) {
        const exp = resume.experience[i];
        if (!exp.bullets || !Array.isArray(exp.bullets)) continue;

        for (let j = 0; j < Math.min(exp.bullets.length, 2); j++) {
          const bullet = exp.bullets[j];
          const bulletKey = `${i}-${j}`;
          
          if (processedBullets.has(bulletKey)) continue; // Skip if already processed
          
          if (!rewriteRules.hasMetrics(bullet)) {
            const sugg = this.suggestAddMetrics(bullet, i, j);
            if (sugg) {
              suggestions.push(sugg);
              processedBullets.add(bulletKey);
              if (suggestions.length >= 5) break;
            }
          }
        }
        if (suggestions.length >= 5) break;
      }
    }

    // ─ 4. Summary ─
    if (!resume.summary || resume.summary.length < 100) {
      const sugg = this.suggestImproveSummary(resume.summary);
      if (sugg) suggestions.push(sugg);
    }

    console.log(`🆕 [SuggestionRuleEngine] GENERATED ${suggestions.length} suggestions:`);
    suggestions.slice(0, 5).forEach((s, i) => {
      console.log(`   ${i+1}. [${s.type}] ${s.section}: "${s.improvedText.substring(0, 50)}..."`);
    });
    
    return suggestions;
  }
}

module.exports = SuggestionRuleEngine;
