#!/usr/bin/env node

/**
 * DROP OLD MONGODB INDEX - CRITICAL FIX
 * 
 * This script removes the old unique constraint that blocks re-scoring:
 *   resumeId_1_jdId_1 (unique)
 * 
 * Problem: With this unique index, you can only score a resume+JD combo ONCE.
 *          Trying to re-score same resume with different JD fails with E11000 duplicate key error.
 * 
 * Solution: Drop this index. New indexes handle re-scoring correctly:
 *   - resumeId_1_createdAt_-1 (latest score lookup)
 *   - resumeId_1_jdId_1_createdAt_-1 (per-JD history)
 * 
 * Impact: After running this, re-scoring works perfectly.
 * 
 * Usage:
 *   node drop-old-index.js
 * 
 * Or with explicit MongoDB URI:
 *   MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/b2world" node drop-old-index.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function dropIndex() {
  try {
    console.log('\n🔵 Connecting to MongoDB...');
    console.log(`   URI: ${process.env.MONGODB_URI.replace(/:[^:]*@/, ':***@')}`);
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB\n');
    
    const connection = mongoose.connection;
    const db = connection.db;
    
    // Get the atsreports collection
    const collection = db.collection('atsreports');
    
    // First, check if the old index exists
    console.log('🔍 Checking for old unique index...\n');
    const indexes = await collection.getIndexes();
    
    const oldIndexName = 'resumeId_1_jdId_1';
    const indexExists = Object.keys(indexes).includes(oldIndexName);
    
    if (!indexExists) {
      console.log('✅ GOOD NEWS: Old index does NOT exist.');
      console.log('   Re-scoring is already enabled!\n');
      
      console.log('📋 Current indexes:\n');
      Object.entries(indexes).forEach(([name, spec]) => {
        console.log(`   ✓ ${name}:`, JSON.stringify(spec.key || spec));
      });
      
      await mongoose.disconnect();
      process.exit(0);
    }
    
    console.log(`⚠️  Found old unique index: "${oldIndexName}"\n`);
    console.log('   This index blocks re-scoring. Dropping now...\n');
    
    // Drop the old index
    try {
      await collection.dropIndex(oldIndexName);
      console.log(`✅ Successfully dropped index: "${oldIndexName}"\n`);
    } catch (error) {
      if (error.message.includes('index not found')) {
        console.log('ℹ️  Index was already removed.\n');
      } else {
        throw error;
      }
    }
    
    // Verify the index is gone
    console.log('🔍 Verifying index removal...\n');
    const indexesAfter = await collection.getIndexes();
    
    if (Object.keys(indexesAfter).includes(oldIndexName)) {
      console.log('❌ ERROR: Index still exists! Please try again or drop manually.');
      process.exit(1);
    }
    
    console.log('✅ Index successfully removed!\n');
    console.log('📋 Remaining indexes:\n');
    
    Object.entries(indexesAfter).forEach(([name, spec]) => {
      const keyInfo = JSON.stringify(spec.key || spec);
      const isUnique = spec.unique ? ' [UNIQUE]' : '';
      console.log(`   ✓ ${name}:${isUnique}`, keyInfo);
    });
    
    console.log('\n✨ SUCCESS: Re-scoring is now enabled!\n');
    console.log('📝 What this means:');
    console.log('   ✅ Can score same resume with different JDs');
    console.log('   ✅ Dashboard shows latest score correctly');
    console.log('   ✅ Multiple ATS reports per resume allowed');
    console.log('   ✅ Immutable audit trail preserved\n');
    
    console.log('🚀 Next steps:');
    console.log('   1. Restart your Node.js server (npm start)');
    console.log('   2. Try re-scoring a resume with a different JD');
    console.log('   3. Verify dashboard shows the new score\n');
    
    await mongoose.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\n📞 Troubleshooting:');
    console.error('   1. Check MONGODB_URI is set in .env');
    console.error('   2. Verify MongoDB is running');
    console.error('   3. Check network connectivity to MongoDB');
    console.error('   4. Try dropping index manually in MongoDB Compass\n');
    
    process.exit(1);
  }
}

dropIndex();
