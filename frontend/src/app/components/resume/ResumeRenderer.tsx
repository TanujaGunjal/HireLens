import React from "react";
import { getTemplateComponent, normalizeTemplateId } from "../../utils/templateResolver";

interface ResumeRendererProps {
  templateId?: string;
  data: any;
  className?: string;
}

/**
 * ResumeRenderer - Renders the appropriate resume template based on templateId
 * Supports: classic, fresher, tech, experienced-tech (alias)
 * 
 * ✅ STEP 3: Uses getTemplateComponent from templateResolver
 * ✅ Ensures consistency between preview and PDF generation
 * ✅ Normalizes template IDs to handle aliases
 */
const ResumeRenderer: React.FC<ResumeRendererProps> = ({
  templateId = "classic",
  data,
  className = ""
}) => {
  if (!data) {
    return (
      <div className={className}>
        <p className="text-gray-500">No resume data available</p>
      </div>
    );
  }

  // ✅ STEP 2: Normalize template ID (handles 'experienced-tech' → 'tech')
  const normalizedId = normalizeTemplateId(templateId);
  
  // 🔴 DEBUG LOGGING
  console.log(`%c[ResumeRenderer] TEMPLATE RESOLUTION`, 'color: blue; font-weight: bold');
  console.log(`  Input templateId: "${templateId}"`);
  console.log(`  Normalized to: "${normalizedId}"`);
  console.log(`  Component name:`, getTemplateComponent(normalizedId)?.name || 'UNKNOWN');
  
  // ✅ STEP 3: Get the template component using the resolver
  const TemplateComponent = getTemplateComponent(normalizedId);
  
  if (!TemplateComponent) {
    console.error(`[ResumeRenderer] ❌ Failed to resolve template component for: "${normalizedId}"`);
    return (
      <div className={className}>
        <p className="text-red-500">Error: Template not found</p>
      </div>
    );
  }
  
  console.log(`%c✅ Rendering: ${TemplateComponent.name}`, 'color: green; font-weight: bold; font-size: 14px');
  
  return <TemplateComponent data={data} className={className} />;
};

export default ResumeRenderer;
