const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  resumeTitle: {
    type: String,
    required: [true, 'Resume title is required'],
    trim: true,
    maxlength: [100, 'Resume title cannot exceed 100 characters']
  },
  // ISSUE #1 FIX: Store JD reference for scoring mode detection
  jdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobDescription',
    index: true,
    default: null
  },
  personalInfo: {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    linkedin: {
      type: String,
      trim: true
    },
    github: {
      type: String,
      trim: true
    },
    portfolio: {
      type: String,
      trim: true
    }
  },
  summary: {
    type: String,
    trim: true,
    maxlength: [1000, 'Summary cannot exceed 1000 characters']
  },
  skills: [{
    category: {
      type: String,
      required: true,
      trim: true
    },
    items: [{
      type: String,
      trim: true
    }]
  }],
  experience: [{
    company: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    startDate: {
      type: String,
      required: true
    },
    endDate: {
      type: String
    },
    current: {
      type: Boolean,
      default: false
    },
    bullets: [{
      type: String,
      trim: true
    }]
  }],
  projects: [{
    title: {
      type: String,
      required: true,
      trim: true
    },
    techStack: [{
      type: String,
      trim: true
    }],
    link: {
      type: String,
      trim: true
    },
    bullets: [{
      type: String,
      trim: true
    }]
  }],
  education: [{
    institution: {
      type: String,
      required: true,
      trim: true
    },
    degree: {
      type: String,
      required: true,
      trim: true
    },
    field: {
      type: String,
      trim: true
    },
    startDate: {
      type: String
    },
    endDate: {
      type: String
    },
    grade: {
      type: String,
      trim: true
    },
    location: {
      type: String,
      trim: true
    }
  }],
  certifications: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    issuer: {
      type: String,
      trim: true
    },
    date: {
      type: String
    },
    credentialId: {
      type: String,
      trim: true
    },
    url: {
      type: String,
      trim: true
    }
  }],
  achievements: [{
    type: String,
    trim: true
  }],
  languages: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    proficiency: {
      type: String,
      enum: ['Native', 'Fluent', 'Professional', 'Intermediate', 'Basic'],
      default: 'Professional'
    }
  }],
  templateId: {
    type: String,
    enum: ['classic', 'fresher', 'tech'],
    default: 'classic'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  atsScore: {
    type: Number,
    default: null,
    min: 0,
    max: 100
  }
}, {
  timestamps: true
});

// Indexes for performance
resumeSchema.index({ userId: 1, createdAt: -1 });
resumeSchema.index({ resumeTitle: 'text', 'personalInfo.fullName': 'text' });

// Virtual for resume completeness percentage
resumeSchema.virtual('completeness').get(function() {
  let score = 0;
  const weights = {
    personalInfo: 10,
    summary: 15,
    skills: 20,
    experience: 25,
    projects: 15,
    education: 10,
    certifications: 5
  };

  if (this.personalInfo?.fullName && this.personalInfo?.email) score += weights.personalInfo;
  if (this.summary && this.summary.length > 50) score += weights.summary;
  if (this.skills && this.skills.length > 0) score += weights.skills;
  if (this.experience && this.experience.length > 0) score += weights.experience;
  if (this.projects && this.projects.length > 0) score += weights.projects;
  if (this.education && this.education.length > 0) score += weights.education;
  if (this.certifications && this.certifications.length > 0) score += weights.certifications;

  return Math.min(score, 100);
});

// Ensure virtuals are included in JSON
resumeSchema.set('toJSON', { virtuals: true });
resumeSchema.set('toObject', { virtuals: true });

const Resume = mongoose.model('Resume', resumeSchema);

module.exports = Resume;
