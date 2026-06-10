const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  templateName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    enum: ['Professional', 'Modern', 'Classic', 'Creative', 'Technical'],
    default: 'Professional'
  },
  layoutConfig: {
    columns: {
      type: Number,
      default: 1,
      min: 1,
      max: 2
    },
    sections: [{
      name: String,
      order: Number,
      required: Boolean,
      visible: Boolean
    }],
    styling: {
      fontFamily: {
        type: String,
        default: 'Arial, sans-serif'
      },
      fontSize: {
        type: Number,
        default: 11
      },
      lineHeight: {
        type: Number,
        default: 1.4
      },
      margins: {
        top: Number,
        bottom: Number,
        left: Number,
        right: Number
      },
      colors: {
        primary: String,
        secondary: String,
        text: String
      },
      spacing: {
        sectionGap: Number,
        itemGap: Number
      }
    },
    features: {
      showIcons: {
        type: Boolean,
        default: false
      },
      showPhoto: {
        type: Boolean,
        default: false
      },
      showRatings: {
        type: Boolean,
        default: false
      }
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft'],
    default: 'active'
  },
  usageCount: {
    type: Number,
    default: 0
  },
  isATSFriendly: {
    type: Boolean,
    default: true
  },
  targetAudience: {
    type: String,
    enum: ['Fresher', 'Experienced', 'Senior', 'Executive', 'All'],
    default: 'All'
  },
  previewImage: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes
templateSchema.index({ status: 1, isATSFriendly: 1 });
templateSchema.index({ usageCount: -1 });

// Increment usage count
templateSchema.methods.incrementUsage = async function() {
  this.usageCount += 1;
  await this.save();
};

const Template = mongoose.model('Template', templateSchema);

module.exports = Template;
