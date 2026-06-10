/**
 * Backfill Resume.atsScore from ATSReport.totalScore
 * This script populates atsScore for all resumes that have been scored
 * but whose atsScore field is null/undefined
 */

const mongoose = require('mongoose');
const Resume = require('../models/Resume');
const ATSReport = require('../models/ATSReport');
require('dotenv').config();

const backfillScores = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ats-resume-builder', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Find all ATSReports
    const reports = await ATSReport.find().lean();
    console.log(`📊 Found ${reports.length} ATSReport records`);

    if (reports.length === 0) {
      console.log('ℹ️  No ATSReport records to backfill');
      await mongoose.connection.close();
      return;
    }

    // Group reports by resumeId and get latest by createdAt
    const latestReportsByResume = {};
    
    for (const report of reports) {
      const resumeId = report.resumeId.toString();
      if (!latestReportsByResume[resumeId] || 
          new Date(report.createdAt) > new Date(latestReportsByResume[resumeId].createdAt)) {
        latestReportsByResume[resumeId] = report;
      }
    }

    console.log(`🎯 Found ${Object.keys(latestReportsByResume).length} unique resumes with scores`);

    // Backfill Resume.atsScore with latest report score
    let updated = 0;
    let unchanged = 0;

    for (const [resumeId, report] of Object.entries(latestReportsByResume)) {
      const result = await Resume.updateOne(
        { _id: resumeId },
        { $set: { atsScore: report.totalScore } }
      );

      if (result.modifiedCount > 0) {
        updated++;
        console.log(`✅ Resume ${resumeId}: atsScore = ${report.totalScore}`);
      } else {
        unchanged++;
      }
    }

    console.log(`\n✅ DONE!`);
    console.log(`   Updated: ${updated} resumes`);
    console.log(`   Unchanged: ${unchanged} resumes`);
    
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during backfill:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
};

backfillScores();
