/**
 * Template System Verification
 * Tests the complete template selection and PDF generation flow
 */

const API_BASE = 'http://localhost:5000/api';

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: defaultHeaders,
    ...options
  });

  const data = await response.json();
  return { status: response.status, data };
}

async function verifyTemplateSystem() {
  console.log('\n🔍 Template System Verification\n');
  
  try {
    // Step 1: Get first resume
    console.log('📋 Step 1: Fetching your resumes...');
    const resumesRes = await apiFetch('/resume');
    
    if (!resumesRes.data.success || !resumesRes.data.data || resumesRes.data.data.length === 0) {
      console.log('❌ No resumes found. Create a resume first.');
      return;
    }

    const resume = resumesRes.data.data[0];
    const resumeId = resume._id;
    console.log(`✅ Found resume: ${resume.resumeTitle}`);
    console.log(`   ID: ${resumeId}`);
    console.log(`   Current Template: "${resume.templateId || 'NOT SET'}"`);

    // Step 2: Update template to Fresher
    console.log('\n📝 Step 2: Updating template to "fresher"...');
    const updateRes = await apiFetch(`/resume/${resumeId}/template`, {
      method: 'PATCH',
      body: JSON.stringify({ templateId: 'fresher' })
    });

    if (!updateRes.data.success) {
      console.log('❌ Failed to update template:', updateRes.data.message);
      return;
    }

    const updatedTemplate = updateRes.data.data?.resume?.templateId;
    console.log(`✅ Template updated to: "${updatedTemplate}"`);

    // Step 3: Fetch fresh resume
    console.log('\n🔄 Step 3: Fetching resume from database...');
    const freshRes = await apiFetch(`/resume/${resumeId}`);
    const freshTemplate = freshRes.data.data?.templateId;
    console.log(`✅ Fresh template from DB: "${freshTemplate}"`);

    if (freshTemplate !== 'fresher') {
      console.log(`⚠️  WARNING: Template not persisted! Expected "fresher", got "${freshTemplate}"`);
      return;
    }

    // Step 4: Verify template options
    console.log('\n📋 Step 4: Testing all template options...');
    const templates = ['classic', 'fresh er', 'tech'];
    
    for (const template of templates) {
      const updateTest = await apiFetch(`/resume/${resumeId}/template`, {
        method: 'PATCH',
        body: JSON.stringify({ templateId: template })
      });
      
      if (updateTest.data.success) {
        console.log(`  ✅ ${template}: Can update`);
      } else {
        console.log(`  ⚠️  ${template}: ${updateTest.data.message}`);
      }
    }

    console.log('\n✅ Template System Verification Complete!');
    console.log('\nNext steps:');
    console.log('1. Select a template in the DownloadResume page');
    console.log('2. Check browser console for [Frontend] logs');
    console.log('3. Download PDF');
    console.log('4. Check server logs for [PDF Download] and [PDF Generator] logs');
    console.log('5. Open the PDF and verify it matches the selected template');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Auto-run if inline
if (typeof window !== 'undefined') {
  window.verifyTemplateSystem = verifyTemplateSystem;
  console.log('Template verification ready. Run: verifyTemplateSystem()');
}

module.exports = { verifyTemplateSystem };
