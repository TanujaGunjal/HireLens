#!/usr/bin/env node

/**
 * VERIFICATION SCRIPT - Phase 6 Integration & MongoDB Index Fix
 * 
 * Run this AFTER deployment to verify everything is working:
 * 
 *   node verify-phase6-deployment.js
 * 
 * This script checks:
 * ✅ MongoDB connection
 * ✅ Old index is dropped
 * ✅ New indexes are in place
 * ✅ Phase 6 services load correctly
 * ✅ Code integrations are in place
 * 
 * If all checks pass → System is ready for use
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ️ ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️ ${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}━━━ ${msg} ━━━${colors.reset}`)
};

let checksPassed = 0;
let checksFailed = 0;

/**
 * CHECK 1: MongoDB Connection
 */
async function checkMongoDB() {
  log.section('CHECK 1: MongoDB Connection');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
    });
    log.success(`Connected to MongoDB: ${process.env.MONGODB_URI.substring(0, 50)}...`);
    checksPassed++;
    return true;
  } catch (err) {
    log.error(`Failed to connect: ${err.message}`);
    log.warn('Check MONGODB_URI in .env file');
    checksFailed++;
    return false;
  }
}

/**
 * CHECK 2: Old Index Removed
 */
async function checkIndexDropped() {
  log.section('CHECK 2: MongoDB Indexes');
  
  try {
    const db = mongoose.connection.db;
    const indexes = await db.collection('atsreports').getIndexes();
    
    log.info('Current indexes in atsreports collection:');
    Object.keys(indexes).forEach((indexName) => {
      console.log(`   • ${indexName}`);
    });
    
    if (indexes['resumeId_1_jdId_1']) {
      log.error('Old unique index still exists: resumeId_1_jdId_1');
      log.warn('Run: node scripts/drop-old-index.js');
      checksFailed++;
      return false;
    } else {
      log.success('Old blocking index removed ✓');
      checksPassed++;
    }
    
    // Check for new enabling indexes
    const hasPerResumeIndex = indexes['resumeId_1_createdAt_-1'];
    const hasPerJDIndex = indexes['resumeId_1_jdId_1_createdAt_-1'];
    const hasUserIndex = indexes['userId_1_createdAt_-1'];
    
    if (hasPerResumeIndex && hasPerJDIndex && hasUserIndex) {
      log.success('All enabling indexes present ✓');
      checksPassed++;
    } else {
      log.warn('Some enabling indexes missing (not critical)');
    }
    
    return true;
  } catch (err) {
    log.error(`Failed to check indexes: ${err.message}`);
    checksFailed++;
    return false;
  }
}

/**
 * CHECK 3: Phase 6 Services Load
 */
async function checkPhase6Services() {
  log.section('CHECK 3: Phase 6 Services');
  
  try {
    const normPath = path.join(__dirname, 'b2world-backend1/services/keywordNormalizationService.js');
    const v2Path = path.join(__dirname, 'b2world-backend1/services/atsScoringEngineV2.js');
    
    if (!fs.existsSync(normPath)) {
      log.error('keywordNormalizationService.js not found');
      checksFailed++;
      return false;
    }
    log.success('keywordNormalizationService.js found ✓');
    checksPassed++;
    
    if (!fs.existsSync(v2Path)) {
      log.error('atsScoringEngineV2.js not found');
      checksFailed++;
      return false;
    }
    log.success('atsScoringEngineV2.js found ✓');
    checksPassed++;
    
    // Try to require them
    try {
      delete require.cache[require.resolve('./b2world-backend1/services/keywordNormalizationService.js')];
      delete require.cache[require.resolve('./b2world-backend1/services/atsScoringEngineV2.js')];
      
      const NormService = require('./b2world-backend1/services/keywordNormalizationService.js');
      const V2Engine = require('./b2world-backend1/services/atsScoringEngineV2.js');
      
      log.success('Both services load without errors ✓');
      checksPassed++;
      
      // Check key methods exist
      const norm = new NormService();
      const v2 = new V2Engine();
      
      if (typeof norm.filterAndNormalizeKeywords === 'function') {
        log.success('KeywordNormalizationService.filterAndNormalizeKeywords() exists ✓');
        checksPassed++;
      } else {
        log.error('filterAndNormalizeKeywords() method not found');
        checksFailed++;
      }
      
      if (typeof v2.calculateKeywordMatch === 'function') {
        log.success('ATSScoringEngineV2.calculateKeywordMatch() exists ✓');
        checksPassed++;
      } else {
        log.error('calculateKeywordMatch() method not found');
        checksFailed++;
      }
      
      return true;
    } catch (err) {
      log.error(`Failed to load services: ${err.message}`);
      checksFailed++;
      return false;
    }
  } catch (err) {
    log.error(`Services check failed: ${err.message}`);
    checksFailed++;
    return false;
  }
}

/**
 * CHECK 4: Code Integrations
 */
async function checkCodeIntegrations() {
  log.section('CHECK 4: Code Integrations');
  
  try {
    const jdControllerPath = path.join(__dirname, 'b2world-backend1/controllers/jdController.js');
    const atsServicePath = path.join(__dirname, 'b2world-backend1/services/atsService.js');
    
    // Check jdController
    if (!fs.existsSync(jdControllerPath)) {
      log.error('jdController.js not found');
      checksFailed++;
    } else {
      const jdContent = fs.readFileSync(jdControllerPath, 'utf8');
      
      if (jdContent.includes('KeywordNormalizationService')) {
        log.success('jdController.js has KeywordNormalizationService integration ✓');
        checksPassed++;
      } else {
        log.error('jdController.js missing KeywordNormalizationService import');
        log.warn('Phase 6 not integrated into JD analysis endpoint');
        checksFailed++;
      }
      
      if (jdContent.includes('filterAndNormalizeKeywords')) {
        log.success('jdController.js calls normalization function ✓');
        checksPassed++;
      } else {
        log.error('jdController.js not calling normalization function');
        checksFailed++;
      }
    }
    
    // Check atsService
    if (!fs.existsSync(atsServicePath)) {
      log.error('atsService.js not found');
      checksFailed++;
    } else {
      const atsContent = fs.readFileSync(atsServicePath, 'utf8');
      
      if (atsContent.includes('ATSScoringEngineV2')) {
        log.success('atsService.js has ATSScoringEngineV2 integration ✓');
        checksPassed++;
      } else {
        log.error('atsService.js missing ATSScoringEngineV2 import');
        log.warn('Phase 6 not integrated into scoring endpoint');
        checksFailed++;
      }
      
      if (atsContent.includes('calculateKeywordMatch')) {
        log.success('atsService.js calls weighted matching ✓');
        checksPassed++;
      } else {
        log.error('atsService.js not using v2 engine');
        checksFailed++;
      }
    }
    
    return true;
  } catch (err) {
    log.error(`Integration check failed: ${err.message}`);
    checksFailed++;
    return false;
  }
}

/**
 * CHECK 5: Node.js Server Health
 */
async function checkServerHealth() {
  log.section('CHECK 5: Server Status');
  
  try {
    const response = await fetch('http://localhost:5000/api/health', {
      timeout: 5000
    }).catch(() => null);
    
    if (response && response.ok) {
      log.success('Server is running on port 5000 ✓');
      checksPassed++;
    } else {
      log.warn('Server not responding (may not be running)');
      log.info('Start server with: npm start');
    }
    
    return true;
  } catch (err) {
    log.warn(`Server health check skipped (${err.message})`);
  }
}

/**
 * SUMMARY
 */
async function printSummary() {
  log.section('VERIFICATION SUMMARY');
  
  const totalChecks = checksPassed + checksFailed;
  const percentage = Math.round((checksPassed / totalChecks) * 100);
  
  console.log(`\nResults: ${checksPassed}/${totalChecks} checks passed (${percentage}%)\n`);
  
  if (checksFailed === 0) {
    log.success('✨ ALL CHECKS PASSED - System is ready! ✨');
    log.info('You can now:');
    console.log('   1. Upload JDs and verify keywords are normalized');
    console.log('   2. Score resumes and re-score with different JDs');
    console.log('   3. Check dashboard shows latest scores');
    return 0;
  } else if (checksFailed <= 2) {
    log.warn(`⚠️ ${checksFailed} issues found - Review above for details`);
    log.info('Next steps:');
    console.log('   1. Fix the issues listed above');
    console.log('   2. Run this script again to verify');
    return 1;
  } else {
    log.error(`❌ Multiple issues found (${checksFailed})`);
    log.warn('Cannot proceed with deployment. Fix issues and retry.');
    return 1;
  }
}

/**
 * MAIN
 */
async function main() {
  console.log(`\n${colors.cyan}╔════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║   Phase 6 & MongoDB Fix - Verification Script   ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════╝${colors.reset}\n`);
  
  const mongoConnected = await checkMongoDB();
  
  if (mongoConnected) {
    await checkIndexDropped();
    await checkPhase6Services();
    await checkCodeIntegrations();
  }
  
  await checkServerHealth();
  
  const exitCode = await printSummary();
  
  // Cleanup
  if (mongoose.connection) {
    await mongoose.connection.close();
  }
  
  process.exit(exitCode);
}

// Run verification
main().catch(err => {
  log.error(`Verification failed: ${err.message}`);
  process.exit(1);
});
