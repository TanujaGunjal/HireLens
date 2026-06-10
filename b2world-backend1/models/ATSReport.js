const mongoose = require('mongoose');

const atsReportSchema = new mongoose.Schema({
  resumeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resume',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  jdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobDescription',
    index: true
  },
  // 🔥 CRITICAL FIX: Cache JD keywords for persistence
  // Ensures keywords don't get lost between flows
  jdKeywords: {
    type: [String],
    default: [],
    required: false
  },
  totalScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  // SCHEMA FIX: Removed duplicate 'score' field — use totalScore only
  keywordMatchPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  breakdown: {
    keywordMatchScore: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 40 },
      details: {
        matchedKeywords: [String],
        totalJDKeywords: Number,
        matchPercentage: Number
      }
    },
    sectionCompletenessScore: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 20 },
      details: {
        presentSections: [String],
        missingSections: [String]
      }
    },
    formattingScore: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 20 },
      details: {
        hasImages: Boolean,
        hasTables: Boolean,
        hasMultipleColumns: Boolean,
        fontIssues: [String]
      }
    },
    actionVerbScore: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 10 },
      details: {
        actionVerbsFound: [String],
        totalBullets: Number,
        bulletsWithActionVerbs: Number
      }
    },
    readabilityScore: {
      score: { type: Number, default: 0 },
      weight: { type: Number, default: 10 },
      details: {
        avgBulletLength: Number,
        longBullets: Number,
        duplicateWords: [String]
      }
    }
  },
  missingKeywords: {
    type: [String],
    default: []
  },
suggestions: [{
  id: {
    type: String,
    required: true,
    trim: true
  },

  type: {
    type: String,
    enum: [
      'keyword', 'experience', 'skills', 'projects', 'education', 'certifications',
      'summary', 'formatting', 'readability', 'action_verb',
      'missing_keyword', 'content', 'grammar', 'structure', 'weak_verb',
      'weak_bullet', 'missing_metrics', 'suggestion'
    ],
    required: true
  },

  severity: {
    type: String,
    enum: ['critical', 'important', 'suggestion', 'high', 'medium', 'low'],
    required: true,
    default: 'suggestion'
  },

  section: {
    type: String,
    required: true,
    trim: true,
    enum: ['summary', 'experience', 'projects', 'skills', 'education', 'certifications']
  },

  targetSection: {
    type: String,
    trim: true
  },

  currentText: {
    type: String,
    default: ''
  },

  suggestedText: {
    type: String,
    default: ''
  },

  improvedText: {
    type: String,
    required: true,
    default: ''
  },

  itemIndex: {
    type: Number,
    default: null
  },

  bulletIndex: {
    type: Number,
    default: null
  },

  reason: {
    type: String,
    default: ''
  },

  impact: {
    type: String,
    enum: ['high', 'medium', 'low'],
    lowercase: true,
    trim: true,
    default: 'medium'
  },

  applied: {
    type: Boolean,
    default: false
  },

  confidenceScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.7
  },

  appliedAt: Date
}],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes (PRODUCTION ARCHITECTURE)
// ⚠️ MIGRATION REQUIRED (run once after deploy):
// db.atsreports.dropIndex("resumeId_1_jdId_1")
// This removes the old unique constraint that blocked re-scoring

atsReportSchema.index({ resumeId: 1, createdAt: -1 });  // latest-first lookup (PRIMARY)
atsReportSchema.index({ resumeId: 1, jdId: 1, createdAt: -1 });  // per-JD history
atsReportSchema.index({ userId: 1, createdAt: -1 });    // user-scoped queries
atsReportSchema.index({ totalScore: -1 });              // leaderboard queries

// Method to calculate weighted total score
atsReportSchema.methods.calculateTotalScore = function() {
  const breakdown = this.breakdown;
  let total = 0;

  // Calculate each component's contribution
  total += (breakdown.keywordMatchScore.score * breakdown.keywordMatchScore.weight) / 100;
  total += (breakdown.sectionCompletenessScore.score * breakdown.sectionCompletenessScore.weight) / 100;
  total += (breakdown.formattingScore.score * breakdown.formattingScore.weight) / 100;
  total += (breakdown.actionVerbScore.score * breakdown.actionVerbScore.weight) / 100;
  total += (breakdown.readabilityScore.score * breakdown.readabilityScore.weight) / 100;

  this.totalScore = Math.round(total);
  return this.totalScore;
};

const ATSReport = mongoose.model('ATSReport', atsReportSchema);

module.exports = ATSReport;