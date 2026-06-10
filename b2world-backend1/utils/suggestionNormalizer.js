const IMPACT_TO_SEVERITY_MAP = {
  'high':   'important',
  'medium': 'suggestion',
  'low':    'suggestion'
};

const TYPE_NORMALIZATION_MAP = {
  'keyword_missing':  'missing_keyword',
  'weak_summary':     'content',
  'keyword':          'keyword',
  'missing_keyword':  'missing_keyword',
  'formatting':       'formatting',
  'content':          'content',
  'grammar':          'grammar',
  'structure':        'structure',
  'weak_verb':        'weak_verb',
  'weak_bullet':      'weak_bullet',
  'missing_metrics':  'missing_metrics',
  'suggestion':       'suggestion',
};

const VALID_TYPES = new Set([
  'keyword', 'missing_keyword', 'formatting', 'content',
  'grammar', 'structure', 'weak_verb', 'weak_bullet', 'missing_metrics', 'suggestion'
]);

const VALID_SEVERITIES = new Set([
  'critical', 'important', 'suggestion', 'high', 'medium', 'low'
]);

const DEFAULT_SECTION = 'experience';

function normalizeSuggestion(rawSuggestion, idx) {
  if (idx === undefined) idx = 0;
  if (!rawSuggestion || !rawSuggestion.improvedText || String(rawSuggestion.improvedText).trim() === '') {
    return null;
  }
  if (!rawSuggestion.section) {
    return null;
  }

  var rawType     = rawSuggestion.type || 'suggestion';
  var rawSeverity = rawSuggestion.severity || rawSuggestion.impact || 'medium';
  var section     = rawSuggestion.section || DEFAULT_SECTION;

  var normalizedType = TYPE_NORMALIZATION_MAP[rawType] || 'suggestion';
  if (!VALID_TYPES.has(normalizedType)) {
    normalizedType = 'suggestion';
  }

  var normalizedSeverity = IMPACT_TO_SEVERITY_MAP[rawSeverity] || rawSeverity;
  if (!VALID_SEVERITIES.has(normalizedSeverity)) {
    normalizedSeverity = 'suggestion';
  }

  return {
    id:              rawSuggestion.id || ('sugg_auto_' + idx + '_' + Date.now()),
    type:            normalizedType,
    severity:        normalizedSeverity,
    section:         section,
    targetSection:   rawSuggestion.targetSection || section,
    currentText:     String(rawSuggestion.originalText || rawSuggestion.currentText || '').trim(),
    improvedText:    String(rawSuggestion.improvedText).trim(),
    suggestedText:   String(rawSuggestion.suggestedText || rawSuggestion.improvedText || '').trim(),
    reason:          String(rawSuggestion.reason || rawSuggestion.title || '').trim(),
    impact:          rawSuggestion.impact || 'medium',
    itemIndex:       rawSuggestion.itemIndex   !== undefined ? rawSuggestion.itemIndex   : null,
    bulletIndex:     rawSuggestion.bulletIndex !== undefined ? rawSuggestion.bulletIndex : null,
    applied:         false,
    autoApplicable:  rawSuggestion.autoApplicable === true,
    confidenceScore: rawSuggestion.confidence || rawSuggestion.confidenceScore || 0.7
  };
}

function normalizeSuggestions(rawSuggestions) {
  if (!Array.isArray(rawSuggestions)) rawSuggestions = [];

  return rawSuggestions
    .map(function(sugg, idx) { return normalizeSuggestion(sugg, idx); })
    .filter(function(sugg) { return sugg !== null; })
    .filter(function(sugg) {
      // HARD FINAL GUARD: drop any type that is still not in the schema enum
      return VALID_TYPES.has(sugg.type);
    });
}

function validateSuggestion(suggestion) {
  var errors = [];
  if (!suggestion.id)           errors.push('Missing: id');
  if (!suggestion.type)         errors.push('Missing: type');
  if (!suggestion.severity)     errors.push('Missing: severity');
  if (!suggestion.section)      errors.push('Missing: section');
  if (!suggestion.improvedText) errors.push('Missing: improvedText');
  if (suggestion.type && !VALID_TYPES.has(suggestion.type)) {
    errors.push('Invalid type: ' + suggestion.type);
  }
  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  normalizeSuggestion:  normalizeSuggestion,
  normalizeSuggestions: normalizeSuggestions,
  validateSuggestion:   validateSuggestion,
  VALID_TYPES:          VALID_TYPES,
  VALID_SEVERITIES:     VALID_SEVERITIES,
};
