/**
 * Template Resolver
 * Maps template IDs to their corresponding React components
 * Used for consistent template rendering between preview and PDF
 */

import ClassicTemplate from '../components/resume/templates/ClassicTemplate';
import FresherTemplate from '../components/resume/templates/FresherTemplate';
import TechTemplate from '../components/resume/templates/TechTemplate';

export type TemplateType = 'classic' | 'fresher' | 'tech' | 'experienced-tech';

/**
 * Get the appropriate template component for the given template ID
 * This ensures preview and PDF use the same template logic
 * CRITICAL: Handles both 'tech' and 'experienced-tech' aliases
 */
export function getTemplateComponent(templateId?: string | null) {
  // Normalize and validate template ID
  const normalizedId = (templateId || 'classic').toLowerCase().trim();
  
  switch (normalizedId) {
    // ✅ STEP 1: Import TechTemplate - DONE
    // ✅ STEP 2: Handle all template cases including fallback
    case 'fresher':
      console.debug(`[Template Resolver] Selected: FresherTemplate`);
      return FresherTemplate;
    
    case 'tech':
    case 'experienced-tech':  // Fallback alias for tech template
      console.debug(`[Template Resolver] Selected: TechTemplate`);
      return TechTemplate;
    
    case 'classic':
    default:
      if (normalizedId !== 'classic' && templateId) {
        console.warn(`[Template Resolver] Unknown template "${templateId}", falling back to ClassicTemplate`);
      }
      console.debug(`[Template Resolver] Selected: ClassicTemplate`);
      return ClassicTemplate;
  }
}

/**
 * Validate that the template ID is valid
 * Also accepts 'experienced-tech' as an alias for 'tech'
 */
export function isValidTemplate(templateId: string): boolean {
  const validTemplates = ['classic', 'fresher', 'tech', 'experienced-tech'];
  return validTemplates.includes((templateId || '').toLowerCase().trim());
}

/**
 * Get the default template
 */
export function getDefaultTemplate(): TemplateType {
  return 'classic';
}

/**
 * Map template ID to human-readable name
 */
export function getTemplateName(templateId?: string): string {
  const normalizedId = (templateId || '').toLowerCase().trim();
  
  switch (normalizedId) {
    case 'fresher':
      return 'Fresher Clean';
    case 'tech':
    case 'experienced-tech':
      return 'Experienced Tech';
    case 'classic':
    default:
      return 'Classic Professional';
  }
}

/**
 * Normalize template ID to canonical form
 * Converts 'experienced-tech' to 'tech'
 */
export function normalizeTemplateId(templateId?: string): 'classic' | 'fresher' | 'tech' {
  const normalized = (templateId || 'classic').toLowerCase().trim();
  
  if (normalized === 'experienced-tech') {
    return 'tech';
  }
  
  if (normalized === 'tech') {
    return 'tech';
  }

  if (normalized === 'fresher') {
    return 'fresher';
  }
  
  return 'classic';
}
