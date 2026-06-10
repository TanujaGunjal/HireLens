const mongoose = require('mongoose');

const keywordLibrarySchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['Technical', 'Business', 'Creative', 'Management', 'Support', 'Other'],
    default: 'Technical'
  },
  keywords: [{
    term: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: ['skill', 'tool', 'framework', 'language', 'concept', 'responsibility', 'soft_skill'],
      default: 'skill'
    },
    weight: {
      type: Number,
      default: 1,
      min: 0.1,
      max: 5
    },
    aliases: [{
      type: String,
      trim: true
    }]
  }],
  actionVerbs: [{
    type: String,
    trim: true
  }],
  commonPhrases: [{
    type: String,
    trim: true
  }],
  industryTerms: [{
    type: String,
    trim: true
  }],
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usageCount: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
keywordLibrarySchema.index({ role: 1, isActive: 1 });
keywordLibrarySchema.index({ category: 1 });
keywordLibrarySchema.index({ 'keywords.term': 1 });

// Method to get all keywords as flat array
keywordLibrarySchema.methods.getAllKeywords = function() {
  return this.keywords.map(k => k.term);
};

// Method to search keywords
keywordLibrarySchema.statics.searchKeywords = async function(searchTerm, limit = 50) {
  const regex = new RegExp(searchTerm, 'i');
  return this.find({
    isActive: true,
    $or: [
      { role: regex },
      { 'keywords.term': regex }
    ]
  }).limit(limit);
};

const KeywordLibrary = mongoose.model('KeywordLibrary', keywordLibrarySchema);

module.exports = KeywordLibrary;
