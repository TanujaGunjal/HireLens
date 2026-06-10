const puppeteer = require('puppeteer');
const { sanitizeResume } = require('./resumeSanitizer');

/**
 * PDFGenerator - Generates ATS-friendly PDF resumes using Puppeteer
 * Ensures single-column, clean formatting
 * Uses resumeSanitizer to prevent suggestion text from entering PDF
 */

class PDFGenerator {
  
  /**
   * Generate PDF from resume data with retry logic
   * Now includes sanitization before PDF generation
   */
  async generatePDF(resume, retries = 2) {
    let browser;
    let lastError;
    
    // CRITICAL: Sanitize resume before PDF generation to prevent suggestion text leakage
    const sanitizedResume = sanitizeResume(resume);
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Launch headless browser
        browser = await puppeteer.launch({
          headless: true,  // headless: 'new' is deprecated in Puppeteer v22+
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--no-first-run',
            '--no-zygote',
            '--single-process'  // For Render/Railway deployments
          ],
          timeout: 30000
        });

        const page = await browser.newPage();
        
        // Set timeout for page operations
        page.setDefaultTimeout(20000);
        
        // Generate HTML content using SANITIZED resume
        const htmlContent = this.generateHTML(sanitizedResume);
        
        // Validate HTML content
        if (!htmlContent || htmlContent.length < 100) {
          throw new Error('Invalid HTML content generated');
        }
        
        // Set content with timeout
        await page.setContent(htmlContent, {
          waitUntil: 'networkidle0',
          timeout: 20000
        });

        // Generate PDF with proper settings
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '0.5in',
            right: '0.5in',
            bottom: '0.5in',
            left: '0.5in'
          },
          preferCSSPageSize: false,
          timeout: 30000
        });

        await browser.close();
        
        // Validate PDF buffer
        if (!pdfBuffer || pdfBuffer.length < 1000) {
          throw new Error('Generated PDF is too small or empty');
        }
        
        console.log(`✅ PDF generated successfully (${pdfBuffer.length} bytes)`);
        return pdfBuffer;

      } catch (error) {
        lastError = error;
        console.error(`PDF Generation attempt ${attempt + 1} failed:`, error.message);
        
        // Clean up browser if it exists
        if (browser) {
          try {
            await browser.close();
          } catch (closeError) {
            console.error('Error closing browser:', closeError.message);
          }
        }
        
        // If this is not the last attempt, wait before retrying
        if (attempt < retries) {
          const waitTime = (attempt + 1) * 1000; // 1s, 2s
          console.log(`Retrying in ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // If all retries failed, throw the last error
    throw new Error(`PDF Generation failed after ${retries + 1} attempts: ${lastError.message}`);
  }

  /**
   * Generate HTML content for PDF
   */
  generateHTML(resume) {
    const template = resume.templateId || 'classic';
    
    // ✅ Ensure template value is normalized
    const normalizedTemplate = this.normalizeTemplate(template);
    
    // Log template selection for debugging
    console.log(`[PDF Generator] Template from resume.templateId: "${resume.templateId}"`);
    console.log(`[PDF Generator] Normalized template: "${normalizedTemplate}"`);
    console.log(`[PDF Generator] Using template: "${normalizedTemplate}"`);
    console.log(`[PDF Generator] Body class will be: "${normalizedTemplate}"`);

    const styles = this.getStyles(normalizedTemplate);
    const content = this.generateContent(resume, normalizedTemplate);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${resume.personalInfo?.fullName || 'Resume'}</title>
  <meta name="template" content="${normalizedTemplate}">
  <style>${styles}</style>
</head>
<body class="${normalizedTemplate}">
  ${content}
</body>
</html>
    `;
    
    console.log(`[PDF Generator] HTML generated with ${html.length} characters`);
    return html;
  }

  /**
   * Normalize template ID (handles tech/experienced-tech aliases)
   */
  normalizeTemplate(template) {
    if (!template) return 'classic';
    
    const normalized = template.toLowerCase().trim();
    
    // Handle 'experienced-tech' alias → convert to 'tech'
    if (normalized === 'experienced-tech') {
      console.log(`[PDF Generator] Normalizing: "experienced-tech" → "tech"`);
      return 'tech';
    }
    
    // Validate against allowed templates
    const validTemplates = ['classic', 'fresher', 'tech'];
    if (!validTemplates.includes(normalized)) {
      console.warn(`[PDF Generator] Unknown template "${template}", defaulting to "classic"`);
      return 'classic';
    }
    
    return normalized;
  }


  /**
   * Get CSS styles for ATS-friendly resume
   */
  getStyles(template) {
    let styles = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #000000;
      background: #ffffff;
    }

    .container {
      max-width: 100%;
      padding: 0;
    }

    /* Header Section */
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #000000;
    }

    .header h1 {
      font-size: 22pt;
      font-weight: bold;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .contact-info {
      font-size: 10pt;
      line-height: 1.6;
    }

    .contact-info span {
      margin: 0 10px;
    }

    /* Section Headings */
    .section {
      margin-bottom: 18px;
    }

    .section-title {
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1.5px solid #000000;
      letter-spacing: 0.5px;
    }

    .company-role {
      font-weight: bold;
      font-size: 11.5pt;
    }

    /* ENHANCED: Missing styles for better PDF formatting */
    .bullet-list {
      margin: 6px 0 0 18px;
      padding: 0;
    }
    .bullet-list li {
      margin-bottom: 4px;
      line-height: 1.5;
    }
    .experience-item, .project-item, .education-item, .certification-item {
      margin-bottom: 14px;
    }
    .experience-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: wrap;
    }
    .duration-location {
      font-size: 10pt;
      color: #444444;
      font-style: italic;
    }
    .skills-category {
      margin-bottom: 6px;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: baseline;
    }
    .skills-category-name {
      font-weight: bold;
      font-size: 10.5pt;
      min-width: 120px;
    }
    .skills-list {
      font-size: 10pt;
      color: #111;
    }
    .project-header {
      font-weight: bold;
      font-size: 11.5pt;
    }
    .tech-stack {
      font-size: 10pt;
      color: #333;
      margin: 3px 0;
      font-style: italic;
    }
    .education-header {
      font-weight: bold;
      font-size: 11pt;
    }
    .education-details {
      font-size: 10pt;
      color: #444;
    }
    .certification-name {
      font-weight: bold;
    }
    .certification-details {
      font-size: 10pt;
      color: #555;
    }
    .language-item {
      display: inline-block;
      margin-right: 20px;
      font-size: 10.5pt;
    }
    .summary {
      font-size: 10.5pt;
      line-height: 1.6;
      color: #111;
    }
  `;

  // CLASSIC STYLE (default - already applied above)
  if (template === 'classic') {
    styles += `
      /* Classic Professional - Primary styles already applied */
      body.classic .header {
        border-bottom: 2px solid #000000;
      }

      body.classic .section-title {
        border-bottom: 1.5px solid #000000;
        color: #000000;
      }
    `;
  }

  // FRESHER STYLE
  if (template === 'fresher') {
    styles += `
      body.fresher {
        font-family: 'Calibri', sans-serif;
      }

      body.fresher .header {
        border-bottom: 3px solid #1565c0;
        background-color: #f5f5f5;
        padding: 15px 0;
      }

      body.fresher .header h1 {
        color: #1565c0;
      }

      body.fresher .section-title {
        border-bottom: 2px solid #1565c0;
        color: #1565c0;
        padding-bottom: 6px;
      }

      body.fresher .company-role {
        color: #1565c0;
      }
    `;
  }

  // TECH STYLE
  if (template === 'tech') {
    styles += `
      body.tech {
        font-family: 'Helvetica', sans-serif;
      }

      body.tech .header {
        border-bottom: 3px solid #333333;
        background-color: #f9f9f9;
        padding: 15px 0;
      }

      body.tech .header h1 {
        font-size: 24pt;
        letter-spacing: 2px;
      }

      body.tech .section-title {
        border-bottom: 2px solid #333333;
        color: #333333;
        font-size: 14pt;
        letter-spacing: 1px;
        padding-bottom: 6px;
      }

      body.tech .company-role {
        font-size: 12pt;
        color: #333333;
      }

      body.tech .contact-info {
        font-size: 10pt;
      }
    `;
  }

  return styles;
}



  /**
   * Generate HTML content sections
   */
  generateContent(resume, template = 'classic') {
    let html = '<div class="container">';

    // Header
    html += this.generateHeader(resume.personalInfo);

    // Summary
    if (resume.summary) {
      html += this.generateSummary(resume.summary);
    }

    if (template === 'tech') {
      // TECH TEMPLATE ORDER: Skills → Projects → Experience
      // Skills
      if (resume.skills && resume.skills.length > 0) {
        html += this.generateSkills(resume.skills);
      }

      // Projects (BEFORE experience - key differentiator for tech roles)
      if (resume.projects && resume.projects.length > 0) {
        html += this.generateProjects(resume.projects);
      }

      // Experience
      if (resume.experience && resume.experience.length > 0) {
        html += this.generateExperience(resume.experience);
      }
    } else {
      // CLASSIC & FRESHER TEMPLATE ORDER: Skills → Experience → Projects
      // Skills
      if (resume.skills && resume.skills.length > 0) {
        html += this.generateSkills(resume.skills);
      }

      // Experience
      if (resume.experience && resume.experience.length > 0) {
        html += this.generateExperience(resume.experience);
      }

      // Projects
      if (resume.projects && resume.projects.length > 0) {
        html += this.generateProjects(resume.projects);
      }
    }

    // Education (all templates)
    if (resume.education && resume.education.length > 0) {
      html += this.generateEducation(resume.education);
    }

    // Certifications (all templates)
    if (resume.certifications && resume.certifications.length > 0) {
      html += this.generateCertifications(resume.certifications);
    }

    // Achievements (all templates)
    const achievementLines = this._resolveAchievements(resume);
    if (achievementLines.length > 0) {
      html += this.generateAchievements(achievementLines);
    }

    // Languages (all templates)
    if (resume.languages && resume.languages.length > 0) {
      html += this.generateLanguages(resume.languages);
    }

    html += '</div>';
    return html;
  }

  /**
   * Generate header section
   * FIX: Prevent duplicate contact field rendering with safe fallback logic
   */
  generateHeader(personalInfo) {
    if (!personalInfo) return '';

    // Safe fallback logic - ensure each field renders only once
    const email = personalInfo.email || "";
    const phone = personalInfo.phone || "";
    const location = personalInfo.location || "";
    const linkedin = personalInfo.linkedin || "";
    const github = personalInfo.github || "";

    const contactParts = [];
    if (email) contactParts.push(this.escapeHtml(email));
    if (phone) contactParts.push(this.escapeHtml(phone));
    if (location) contactParts.push(this.escapeHtml(location));
    // Only add LinkedIn if its not already in another field (prevent duplicates)
    if (linkedin && !linkedin.includes(email) && !linkedin.includes(phone)) {
      contactParts.push(this.escapeHtml(linkedin));
    }
    if (github && !github.includes(email) && !github.includes(linkedin)) {
      contactParts.push(this.escapeHtml(github));
    }

    return `
      <div class="header">
        <h1>${this.escapeHtml(personalInfo.fullName || 'Your Name')}</h1>
        <div class="contact-info">
          ${contactParts.join(' | ')}
        </div>
      </div>
    `;
  }

  /**
   * Generate summary section
   */
  generateSummary(summary) {
    return `
      <div class="section">
        <div class="section-title">Professional Summary</div>
        <div class="summary">${this.escapeHtml(summary)}</div>
      </div>
    `;
  }

  /**
   * Generate skills section
   */
  generateSkills(skills) {
    let html = `
      <div class="section">
        <div class="section-title">Technical Skills</div>
    `;

    skills.forEach(skillGroup => {
      html += `
        <div class="skills-category">
          <div class="skills-category-name">${this.escapeHtml(skillGroup.category)}:</div>
          <div class="skills-list">${skillGroup.items.map(item => this.escapeHtml(item)).join(', ')}</div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  /**
   * Generate experience section
   */
  generateExperience(experience) {
    let html = `
      <div class="section">
        <div class="section-title">Professional Experience</div>
    `;

    experience.forEach(exp => {
      const duration = exp.current 
        ? `${exp.startDate} - Present`
        : `${exp.startDate} - ${exp.endDate || 'Present'}`;

      html += `
        <div class="experience-item">
          <div class="experience-header">
            <div class="company-role">
              ${this.escapeHtml(exp.role)} | ${this.escapeHtml(exp.company)}
            </div>
            <div class="duration-location">
              ${this.escapeHtml(duration)}${exp.location ? ' | ' + this.escapeHtml(exp.location) : ''}
            </div>
          </div>
      `;

      if (exp.bullets && exp.bullets.length > 0) {
        html += '<ul class="bullet-list">';
        exp.bullets.forEach(bullet => {
          html += `<li>${this.escapeHtml(bullet)}</li>`;
        });
        html += '</ul>';
      }

      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  /**
   * Generate projects section
   */
  generateProjects(projects) {
    let html = `
      <div class="section">
        <div class="section-title">Projects</div>
    `;

    projects.forEach(project => {
      html += `
        <div class="project-item">
          <div class="project-header">${this.escapeHtml(project.title)}</div>
      `;

      if (project.techStack && project.techStack.length > 0) {
        html += `<div class="tech-stack">Tech Stack: ${project.techStack.map(tech => this.escapeHtml(tech)).join(', ')}</div>`;
      }

      if (project.bullets && project.bullets.length > 0) {
        html += '<ul class="bullet-list">';
        project.bullets.forEach(bullet => {
          html += `<li>${this.escapeHtml(bullet)}</li>`;
        });
        html += '</ul>';
      }

      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  /**
   * Generate education section
   */
  generateEducation(education) {
    let html = `
      <div class="section">
        <div class="section-title">Education</div>
    `;

    education.forEach(edu => {
      html += `
        <div class="education-item">
          <div class="education-header">
            ${this.escapeHtml(edu.degree)}${edu.field ? ' in ' + this.escapeHtml(edu.field) : ''}
          </div>
          <div class="education-details">
            ${this.escapeHtml(edu.institution)}
            ${edu.location ? ' | ' + this.escapeHtml(edu.location) : ''}
            ${edu.endDate ? ' | ' + this.escapeHtml(edu.endDate) : ''}
            ${edu.grade ? ' | ' + this.escapeHtml(edu.grade) : ''}
          </div>
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  /**
   * Generate certifications section
   */
  generateCertifications(certifications) {
    let html = `
      <div class="section">
        <div class="section-title">Certifications</div>
    `;

    certifications.forEach(cert => {
      html += `
        <div class="certification-item">
          <span class="certification-name">${this.escapeHtml(cert.name)}</span>
      `;

      const details = [];
      if (cert.issuer) details.push(this.escapeHtml(cert.issuer));
      if (cert.date) details.push(this.escapeHtml(cert.date));

      if (details.length > 0) {
        html += ` <span class="certification-details">- ${details.join(' | ')}</span>`;
      }

      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  /**
   * Resolve achievements to a flat, clean string[]
   */
  _resolveAchievements(resume) {
    const lines = [];

    if (Array.isArray(resume.achievements)) {
      resume.achievements.forEach(a => {
        if (!a) return;
        if (typeof a === 'string') {
          const clean = a.replace(/^[\s\u2022\-\*]+/, '').trim();
          if (clean) lines.push(clean);
        } else if (typeof a === 'object') {
          const title = (a.title || '').trim();
          const desc  = (a.description || '').trim();
          const combined = desc ? `${title}: ${desc}` : title;
          if (combined) lines.push(combined);
        }
      });
    }

    // Fallback: textarea string
    if (lines.length === 0 && typeof resume.achievementsText === 'string') {
      resume.achievementsText
        .split('\n')
        .map(l => l.replace(/^[\s\u2022\-\*]+/, '').trim())
        .filter(Boolean)
        .forEach(l => lines.push(l));
    }

    return [...new Set(lines)];
  }

  /**
   * Generate achievements section
   */
  generateAchievements(lines) {
    if (!lines || lines.length === 0) return '';
    return `
      <div class="section">
        <div class="section-title">Achievements</div>
        <ul class="bullet-list">
          ${lines.map(l => `<li>${this.escapeHtml(l)}</li>`).join('\n          ')}
        </ul>
      </div>
    `;
  }

  /**
   * Generate languages section
   */
  generateLanguages(languages) {
    return `
      <div class="section">
        <div class="section-title">Languages</div>
        <div>
          ${languages.map(lang => `
            <span class="language-item">
              <strong>${this.escapeHtml(lang.name)}</strong> - ${this.escapeHtml(lang.proficiency)}
            </span>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '<',
      '>': '>',
      '"': '"',
      "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Generate filename for resume
   */
  generateFilename(resume) {
    const name = resume.personalInfo?.fullName || 'Resume';
    const role = resume.experience?.[0]?.role || 'Professional';
    
    const sanitized = `${name}_${role}`
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 50);

    return `B2World_Resume_${sanitized}.pdf`;
  }
}

module.exports = new PDFGenerator();
