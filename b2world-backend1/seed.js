require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Template = require('./models/Template');
const KeywordLibrary = require('./models/KeywordLibrary');
const connectDB = require('./config/db');

/**
 * Database Seed Script
 * Populates initial data for templates and keyword libraries
 */

const seedTemplates = [
  {
    templateName: 'classic',
    displayName: 'Classic Professional',
    description: 'Clean, traditional format suitable for all industries',
    category: 'Professional',
    layoutConfig: {
      columns: 1,
      sections: [
        { name: 'Summary', order: 1, required: true, visible: true },
        { name: 'Skills', order: 2, required: true, visible: true },
        { name: 'Experience', order: 3, required: true, visible: true },
        { name: 'Projects', order: 4, required: false, visible: true },
        { name: 'Education', order: 5, required: true, visible: true },
        { name: 'Certifications', order: 6, required: false, visible: true }
      ],
      styling: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 11,
        lineHeight: 1.4,
        margins: { top: 36, bottom: 36, left: 36, right: 36 },
        colors: { primary: '#000000', secondary: '#333333', text: '#000000' },
        spacing: { sectionGap: 16, itemGap: 8 }
      },
      features: { showIcons: false, showPhoto: false, showRatings: false }
    },
    status: 'active',
    isATSFriendly: true,
    targetAudience: 'All'
  },
  {
    templateName: 'modern',
    displayName: 'Modern Tech',
    description: 'Contemporary design optimized for tech roles',
    category: 'Modern',
    layoutConfig: {
      columns: 1,
      sections: [
        { name: 'Summary', order: 1, required: true, visible: true },
        { name: 'Skills', order: 2, required: true, visible: true },
        { name: 'Experience', order: 3, required: true, visible: true },
        { name: 'Projects', order: 4, required: true, visible: true },
        { name: 'Education', order: 5, required: true, visible: true }
      ],
      styling: {
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontSize: 11,
        lineHeight: 1.4,
        margins: { top: 36, bottom: 36, left: 36, right: 36 },
        colors: { primary: '#000000', secondary: '#555555', text: '#000000' },
        spacing: { sectionGap: 18, itemGap: 10 }
      },
      features: { showIcons: false, showPhoto: false, showRatings: false }
    },
    status: 'active',
    isATSFriendly: true,
    targetAudience: 'Experienced'
  },
  {
    templateName: 'fresher',
    displayName: 'Fresher Friendly',
    description: 'Perfect for students and entry-level candidates',
    category: 'Classic',
    layoutConfig: {
      columns: 1,
      sections: [
        { name: 'Education', order: 1, required: true, visible: true },
        { name: 'Skills', order: 2, required: true, visible: true },
        { name: 'Projects', order: 3, required: true, visible: true },
        { name: 'Experience', order: 4, required: false, visible: true },
        { name: 'Certifications', order: 5, required: false, visible: true }
      ],
      styling: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 11,
        lineHeight: 1.4,
        margins: { top: 36, bottom: 36, left: 36, right: 36 },
        colors: { primary: '#000000', secondary: '#444444', text: '#000000' },
        spacing: { sectionGap: 16, itemGap: 8 }
      },
      features: { showIcons: false, showPhoto: false, showRatings: false }
    },
    status: 'active',
    isATSFriendly: true,
    targetAudience: 'Fresher'
  }
];

const seedKeywordLibraries = [
  {
    role: 'Full Stack Developer',
    category: 'Technical',
    keywords: [
      { term: 'JavaScript', category: 'language', weight: 5 },
      { term: 'React', category: 'framework', weight: 4 },
      { term: 'Node.js', category: 'framework', weight: 4 },
      { term: 'MongoDB', category: 'tool', weight: 3 },
      { term: 'Express', category: 'framework', weight: 3 },
      { term: 'REST API', category: 'concept', weight: 4 },
      { term: 'Git', category: 'tool', weight: 3 },
      { term: 'Docker', category: 'tool', weight: 2 },
      { term: 'AWS', category: 'tool', weight: 3 },
      { term: 'Agile', category: 'concept', weight: 2 }
    ],
    actionVerbs: [
      'Developed', 'Implemented', 'Built', 'Designed', 'Optimized',
      'Deployed', 'Integrated', 'Maintained', 'Led', 'Collaborated'
    ],
    isActive: true
  },
  {
    role: 'Frontend Developer',
    category: 'Technical',
    keywords: [
      { term: 'React', category: 'framework', weight: 5 },
      { term: 'JavaScript', category: 'language', weight: 5 },
      { term: 'TypeScript', category: 'language', weight: 4 },
      { term: 'HTML5', category: 'language', weight: 4 },
      { term: 'CSS3', category: 'language', weight: 4 },
      { term: 'Responsive Design', category: 'concept', weight: 4 },
      { term: 'Redux', category: 'tool', weight: 3 },
      { term: 'Webpack', category: 'tool', weight: 2 },
      { term: 'UI/UX', category: 'concept', weight: 3 }
    ],
    actionVerbs: [
      'Designed', 'Developed', 'Implemented', 'Optimized', 'Enhanced',
      'Created', 'Built', 'Improved', 'Collaborated'
    ],
    isActive: true
  },
  {
    role: 'Backend Developer',
    category: 'Technical',
    keywords: [
      { term: 'Node.js', category: 'framework', weight: 5 },
      { term: 'Python', category: 'language', weight: 4 },
      { term: 'Java', category: 'language', weight: 4 },
      { term: 'SQL', category: 'language', weight: 4 },
      { term: 'MongoDB', category: 'tool', weight: 3 },
      { term: 'REST API', category: 'concept', weight: 5 },
      { term: 'Microservices', category: 'concept', weight: 3 },
      { term: 'Docker', category: 'tool', weight: 3 },
      { term: 'AWS', category: 'tool', weight: 3 }
    ],
    actionVerbs: [
      'Developed', 'Designed', 'Implemented', 'Optimized', 'Scaled',
      'Deployed', 'Maintained', 'Integrated', 'Built'
    ],
    isActive: true
  },
  {
    role: 'Data Scientist',
    category: 'Technical',
    keywords: [
      { term: 'Python', category: 'language', weight: 5 },
      { term: 'Machine Learning', category: 'concept', weight: 5 },
      { term: 'TensorFlow', category: 'framework', weight: 4 },
      { term: 'PyTorch', category: 'framework', weight: 4 },
      { term: 'SQL', category: 'language', weight: 4 },
      { term: 'Data Analysis', category: 'concept', weight: 5 },
      { term: 'Statistics', category: 'concept', weight: 4 },
      { term: 'Pandas', category: 'tool', weight: 3 },
      { term: 'NumPy', category: 'tool', weight: 3 }
    ],
    actionVerbs: [
      'Analyzed', 'Developed', 'Built', 'Trained', 'Optimized',
      'Evaluated', 'Implemented', 'Researched', 'Designed'
    ],
    isActive: true
  }
];

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Connect to database
    await connectDB();

    // Clear existing data (optional - comment out if you don't want to clear)
    console.log('🗑️  Clearing existing templates and keyword libraries...');
    await Template.deleteMany({});
    await KeywordLibrary.deleteMany({});

    // Seed templates
    console.log('📝 Seeding templates...');
    const createdTemplates = await Template.insertMany(seedTemplates);
    console.log(`✅ Created ${createdTemplates.length} templates`);

    // Seed keyword libraries
    console.log('📚 Seeding keyword libraries...');
    const createdLibraries = await KeywordLibrary.insertMany(seedKeywordLibraries);
    console.log(`✅ Created ${createdLibraries.length} keyword libraries`);

    // Create admin user if doesn't exist
    console.log('👤 Checking for admin user...');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@b2world.com';
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const adminUser = new User({
        name: 'Admin',
        email: adminEmail,
        passwordHash: process.env.ADMIN_PASSWORD || 'Admin@123',
        role: 'ADMIN'
      });
      await adminUser.save();
      console.log(`✅ Admin user created: ${adminEmail}`);
    } else {
      console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
    }

    console.log('\n✨ Database seeding completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run seeding
seedDatabase();
