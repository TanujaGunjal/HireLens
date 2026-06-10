/**
 * ATS Production Flow Test Suite
 * Tests: JD Analysis → Score Calculation → Suggestions Generation → Apply Fixes
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment
dotenv.config({ path: '../.env' });

const User = require('../models/User');
const Resume = require('../models/Resume');
const JobDescription = require('../models/JobDescription');
const ATSReport = require('../models/ATSReport');
const atsService = require('../services/atsService');
const suggestionEngine = require('../utils/suggestionEngine');
const KeywordExtractor = require('../utils/keywordExtractorEnhanced');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(color + (new Date().toISOString().substring(11, 19)) + ' |' + COLORS.reset, ...args);
}

async function TEST_JD_KEYWORD_EXTRACTION() {
  log(COLORS.blue, '💂 TEST: JD Keyword Extraction');
  
  const jdText = `
    We are looking for a Senior Backend Engineer with 5+ years of experience.
    Required Skills:
    - Node.js / JavaScript / TypeScript
    - REST APIs & GraphQL
    - PostgreSQL / MongoDB
    - Docker & Kubernetes
    - AWS services (EC2, RDS, S3)
    - Microservices Architecture
    
    Responsibilities:
    - Design and develop scalable backend systems
    - Optimize database performance
    - Lead code reviews
    - Mentor junior developers
  `;
  
  try {
    const extractor = new KeywordExtractor();
    const keywords = extractor.extractKeywords(jdText);
    
    log(COLORS.green, '✓ Extracted keywords:', keywords.length);
    keywords.forEach(k => log(COLORS.cyan, `  - ${k.keyword} (${k.category})`));
    
    return keywords;
  } catch (error) {
    log(COLORS.red, '✗ Failed:', error.message);
    return [];
  }
}

async function TEST_ATS_SCORE_CALCULATION(resume, jd) {
  log(COLORS.blue, '🎯 TEST: ATS Score Calculation');
  
  try {
    const score = await atsService.calculateATSScore(resume._id, jd._id);
    
    log(COLORS.green, `✓ Score calculated: ${score.totalScore}/100 (${score.scoringMode})`);
    log(COLORS.cyan, `  Keyword Match: ${score.breakdown.keywordMatch}%`);
    log(COLORS.cyan, `  Completeness: ${score.breakdown.completeness}%`);
    log(COLORS.cyan, `  Formatting: ${score.breakdown.formatting}%`);
    log(COLORS.cyan, `  Action Verbs: ${score.breakdown.actionVerbs}%`);
    log(COLORS.cyan, `  Readability: ${score.breakdown.readability}%`);
    log(COLORS.cyan, `  Matched Keywords: ${score.matchedKeywords.length}/${score.matchedKeywords.length + score.missingKeywords.length}`);
    
    return score;
  } catch (error) {
    log(COLORS.red, '✗ Failed:', error.message);
    return null;
  }
}

async function TEST_SUGGESTIONS_ENGINE(resume, score, jd) {
  log(COLORS.blue, '💡 TEST: Suggestions Generation');
  
  try {
    const suggestions = suggestionEngine.generateSuggestions(resume.toObject(), score.totalScore, jd);
    
    log(COLORS.green, `✓ Generated ${suggestions.length} suggestions`);
    
    // Count by severity
    const bySeverity = suggestions.reduce((acc, s) => {
      acc[s.severity] = (acc[s.severity] || 0) + 1;
      return acc;
    }, {});
    
    log(COLORS.cyan, `  High: ${bySeverity.high || 0}, Medium: ${bySeverity.medium || 0}, Low: ${bySeverity.low || 0}`);
    
    // Show top 3
    suggestions.slice(0, 3).forEach(s => {
      log(COLORS.cyan, `  > [${s.severity}] ${s.section}: ${s.reason.substring(0, 50)}...`);
    });
    
    return suggestions;
  } catch (error) {
    log(COLORS.red, '✗ Failed:', error.message);
    return [];
  }
}

async function TEST_APPLY_SUGGESTION(resume, suggestion) {
  log(COLORS.blue, '🔧 TEST: Apply Suggestion');
  
  try {
    // Simulate applying a suggestion
    switch (suggestion.section) {
      case 'summary':
        resume.summary = suggestion.suggestedText;
        break;
      case 'experience':
        if (resume.experience && resume.experience[suggestion.targetIndex.expIndex]) {
          resume.experience[suggestion.targetIndex.expIndex].bullets[suggestion.targetIndex.bulletIndex] = suggestion.suggestedText;
        }
        break;
      case 'skills':
        if (!resume.skills) resume.skills = [];
        if (resume.skills.length === 0) resume.skills.push({ category: 'Technical', items: [] });
        resume.skills[0].items.push(suggestion.suggestedText);
        break;
    }
    
    await resume.save();
    log(COLORS.green, `✓ Suggestion applied to ${suggestion.section}`);
    
    return true;
  } catch (error) {
    log(COLORS.red, '✗ Failed:', error.message);
    return false;
  }
}

async function TEST_JDID_PERSISTENCE(resumeId, jdId) {
  log(COLORS.blue, '💾 TEST: JD ID Persistence');
  
  try {
    // Link JD to resume
    const resume = await Resume.findById(resumeId);
    resume.jdId = jdId;
    await resume.save();
    
    log(COLORS.green, '✓ JD ID linked to resume');
    
    // Fetch resume and verify JD ID is there
    const fetched = await Resume.findById(resumeId);
    if (fetched.jdId && fetched.jdId.toString() === jdId.toString()) {
      log(COLORS.green, '✓ JD ID verified on fetch');
      return true;
    } else {
      log(COLORS.red, '✗ JD ID not found on fetch');
      return false;
    }
  } catch (error) {
    log(COLORS.red, '✗ Failed:', error.message);
    return false;
  }
}

async function RUN_FULL_TEST_SUITE() {
  log(COLORS.bright + COLORS.cyan, '\n╔════════════════════════════════════════════════════════╗');
  log(COLORS.bright + COLORS.cyan, '║     ATS PRODUCTION FLOW TEST SUITE                      ║');
  log(COLORS.bright + COLORS.cyan, '╚════════════════════════════════════════════════════════╝\n');
  
  try {
    // Connect to DB
    log(COLORS.blue, '🌐 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ats-builder');
    log(COLORS.green, '✓ Connected\n');
    
    // Find a test user and resume
    log(COLORS.blue, '📋 Loading test data...');
    const user = await User.findOne().lean();
    if (!user) {
      log(COLORS.red, '✗ No users found. Please create a user first.');
      return;
    }
    
    const resume = await Resume.findOne({ userId: user._id }).lean();
    if (!resume) {
      log(COLORS.red, '✗ No resumes found for user.');
      return;
    }
    
    log(COLORS.green, `✓ Using resume: ${resume.resumeTitle}`);
    log(COLORS.green, `✓ Has JD ID?: ${resume.jdId ? '✓' : '✗'}\n`);
    
    // Test keyword extraction
    const keywords = await TEST_JD_KEYWORD_EXTRACTION();
    console.log('');
    
    if (resume.jdId) {
      const jd = await JobDescription.findById(resume.jdId);
      
      if (jd) {
        // Test ATS scoring
        const score = await TEST_ATS_SCORE_CALCULATION(resume, jd);
        console.log('');
        
        // Test suggestions
        const suggestions = await TEST_SUGGESTIONS_ENGINE(resume, score, jd);
        console.log('');
        
        // Test apply suggestion (on a cloned resume)
        const testResume = await Resume.findById(resume._id);
        if (suggestions.length > 0) {
          await TEST_APPLY_SUGGESTION(testResume, suggestions[0]);
        }
        console.log('');
        
        // Test JD ID persistence
        await TEST_JDID_PERSISTENCE(resume._id, jd._id);
      }
    } else {
      log(COLORS.yellow, '⚠️  No JD linked to resume. Skipping score/suggestion tests.');
    }
    
    log(COLORS.bright + COLORS.green, '\n✓ All tests completed!\n');
    
  } catch (error) {
    log(COLORS.red, '\n✗ Test suite failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  RUN_FULL_TEST_SUITE().catch(console.error);
}

module.exports = {
  TEST_JD_KEYWORD_EXTRACTION,
  TEST_ATS_SCORE_CALCULATION,
  TEST_SUGGESTIONS_ENGINE,
  TEST_APPLY_SUGGESTION,
  TEST_JDID_PERSISTENCE
};
