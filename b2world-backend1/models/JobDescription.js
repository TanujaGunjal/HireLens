const mongoose = require('mongoose');

const jobDescriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  resumeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resume',
    index: true
  },
  jdText: {
    type: String,
    required: [true, 'Job description text is required'],
    minlength: [50, 'Job description must be at least 50 characters']
  },
  extractedKeywords: [{
    keyword: String,
    frequency: Number,
    category: {
      type: String,
      enum: ['skill', 'tool', 'responsibility', 'qualification', 'other']
    }
  }],
  roleDetected: {
    type: String,
    trim: true
  },
  companyName: {
    type: String,
    trim: true
  },
  experienceLevel: {
    type: String,
    enum: ['Entry', 'Mid', 'Senior', 'Lead', 'Executive', 'Unknown'],
    default: 'Unknown'
  },
  requiredSkills: [{
    type: String,
    trim: true
  }],
  preferredSkills: [{
    type: String,
    trim: true
  }],
  responsibilities: [{
    type: String,
    trim: true
  }],
  qualifications: [{
    type: String,
    trim: true
  }],
  metadata: {
    wordCount: Number,
    skillsCount: Number,
    toolsCount: Number,
    hasEducationReq: Boolean,
    hasExperienceReq: Boolean
  }
}, {
  timestamps: true
});

// Indexes
jobDescriptionSchema.index({ userId: 1, createdAt: -1 });
jobDescriptionSchema.index({ roleDetected: 1 });

const JobDescription = mongoose.model('JobDescription', jobDescriptionSchema);

module.exports = JobDescription;
