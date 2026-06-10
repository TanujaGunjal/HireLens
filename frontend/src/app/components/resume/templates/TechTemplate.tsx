import React from "react";

interface TechTemplateProps {
  data: any;
  className?: string;
}

/**
 * TechTemplate - Developer-Focused Resume Layout
 * 
 * KEY DIFFERENTIATOR FROM CLASSIC:
 * 1. Blue accent color scheme (not black like Classic)
 * 2. Section order: Name → Skills → Projects → Experience → Education
 *    (Projects highlighted BEFORE experience - crucial for tech roles)
 * 3. Skill categories are displayed prominently with visual cards
 * 4. Project details (tech stack, impact) are emphasized
 * 5. Clean, modern, tech-forward styling
 * 
 * LAYOUT:
 * - Header with blue accents
 * - Technical Skills (with category grouping)
 * - Projects (highlighted with tech stack)
 * - Professional Experience
 * - Education
 * - Certifications (if any)
 * - Languages (if any)
 * - Achievements (if any)
 */
const TechTemplate: React.FC<TechTemplateProps> = ({
  data,
  className = ""
}) => {
  const getAchievementText = (item: any): string | undefined => {
    if (typeof item === "string") return item.trim() || undefined;
    if (typeof item === "object" && item !== null) {
      return (Object.values(item) as any[]).find(
        (v) => typeof v === "string" && v.trim().length > 0
      ) as string | undefined;
    }
    return undefined;
  };

  const hasValidAchievements = (resume: any): boolean => {
    if (!resume?.achievements) return false;
    if (!Array.isArray(resume.achievements)) return false;
    return resume.achievements.some((item: any) => getAchievementText(item));
  };

  return (
    <div
      className={`bg-white rounded-lg p-8 aspect-[8.5/11] overflow-auto shadow-lg text-xs font-['Segoe UI', sans-serif] ${className}`}
    >
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HEADER - BLUE ACCENT (DISTINCTLY DIFFERENT FROM CLASSIC) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {data?.personalInfo && (
        <div className="mb-6 pb-4 border-b-4 border-blue-600">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">
            {data.personalInfo.fullName || "Your Name"}
          </h1>
          <div className="text-xs text-gray-700 space-y-1">
            <p className="flex flex-wrap gap-3">
              {data.personalInfo.email && <span>{data.personalInfo.email}</span>}
              {data.personalInfo.phone && <span>•</span>}
              {data.personalInfo.phone && <span>{data.personalInfo.phone}</span>}
              {data.personalInfo.location && <span>•</span>}
              {data.personalInfo.location && <span>{data.personalInfo.location}</span>}
            </p>
            {(data.personalInfo.linkedin || data.personalInfo.github) && (
              <p className="flex flex-wrap gap-3 text-blue-700">
                {data.personalInfo.linkedin && <span>{data.personalInfo.linkedin}</span>}
                {data.personalInfo.github && (
                  <>
                    {data.personalInfo.linkedin && <span>•</span>}
                    <span>{data.personalInfo.github}</span>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Professional Summary */}
      {data?.summary && (
        <div className="mb-5 italic text-gray-700 text-xs leading-relaxed">
          {data.summary}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TECHNICAL SKILLS - FIRST PRIORITY (BLUE CARDS) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {data?.skills && data.skills.length > 0 && data.skills.some((s: any) => s.items?.length > 0) && (
        <div className="mb-5">
          <h2 className="text-sm font-bold text-blue-600 uppercase border-b-2 border-blue-600 pb-2 mb-3">
            Technical Skills
          </h2>
          <div className="space-y-2">
            {data.skills.map((skillGroup: any, idx: number) => (
              skillGroup.items && skillGroup.items.length > 0 && (
                <div key={idx} className="bg-blue-50 p-2 rounded-md border-l-4 border-blue-600">
                  <div className="font-semibold text-blue-700 text-xs mb-1">
                    {skillGroup.category}
                  </div>
                  <p className="text-gray-700 text-xs leading-relaxed">
                    {skillGroup.items.join(" • ")}
                  </p>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PROJECTS - SECOND PRIORITY (BEFORE EXPERIENCE) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {data?.projects && data.projects.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-bold text-blue-600 uppercase border-b-2 border-blue-600 pb-2 mb-3">
            Projects
          </h2>
          <div className="space-y-3">
            {data.projects.map((proj: any, idx: number) => (
              <div key={idx} className="border-l-4 border-blue-400 pl-3">
                <h3 className="font-bold text-gray-900 text-xs">
                  {proj.title}
                </h3>
                {Array.isArray(proj.techStack) && proj.techStack.length > 0 && (
                  <p className="text-blue-600 font-semibold text-xs mb-1">
                    {proj.techStack.join(" • ")}
                  </p>
                )}
                {proj.description && (
                  <p className="text-gray-700 text-xs mb-1">
                    {proj.description}
                  </p>
                )}
                {Array.isArray(proj.bullets) && proj.bullets.length > 0 && (
                  <ul className="list-disc list-inside text-gray-700 text-xs space-y-0">
                    {proj.bullets.map((bullet: string, bIdx: number) => (
                      <li key={bIdx} className="ml-2">{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PROFESSIONAL EXPERIENCE */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {data?.experience && data.experience.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-bold text-blue-600 uppercase border-b-2 border-blue-600 pb-2 mb-3">
            Professional Experience
          </h2>
          <div className="space-y-3">
            {data.experience.map((exp: any, idx: number) => (
              <div key={idx}>
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="font-bold text-gray-900 text-xs">
                    {exp.role}
                  </h3>
                  <span className="text-gray-600 text-xs font-medium">
                    {exp.startDate} – {exp.current ? "Present" : exp.endDate}
                  </span>
                </div>
                <p className="text-gray-700 text-xs font-semibold mb-1">
                  {exp.company}
                  {exp.location && ` • ${exp.location}`}
                </p>
                {Array.isArray(exp.bullets) && exp.bullets.length > 0 && (
                  <ul className="list-disc list-inside text-gray-700 text-xs space-y-0">
                    {exp.bullets.map((bullet: string, bIdx: number) => (
                      <li key={bIdx} className="ml-2">{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* EDUCATION */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {data?.education && data.education.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-bold text-blue-600 uppercase border-b-2 border-blue-600 pb-2 mb-3">
            Education
          </h2>
          <div className="space-y-2">
            {data.education.map((edu: any, idx: number) => (
              <div key={idx}>
                <h3 className="font-bold text-gray-900 text-xs">
                  {edu.degree}
                  {edu.field && ` in ${edu.field}`}
                </h3>
                <p className="text-gray-700 text-xs">
                  {edu.institution}
                  {edu.endDate && ` • ${edu.endDate}`}
                </p>
                {edu.grade && (
                  <p className="text-gray-600 text-xs">GPA: {edu.grade}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* CERTIFICATIONS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {data?.certifications && data.certifications.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-bold text-blue-600 uppercase border-b-2 border-blue-600 pb-2 mb-2">
            Certifications
          </h2>
          <div className="space-y-1">
            {data.certifications.map((cert: any, idx: number) => (
              <p key={idx} className="text-gray-700 text-xs">
                <span className="font-semibold">{cert.name}</span>
                {cert.issuer && <span> • {cert.issuer}</span>}
                {cert.date && <span> ({cert.date})</span>}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* LANGUAGES */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {data?.languages && data.languages.length > 0 && (
        <div className="mb-5">
          <h2 className="text-sm font-bold text-blue-600 uppercase border-b-2 border-blue-600 pb-2 mb-2">
            Languages
          </h2>
          <p className="text-gray-700 text-xs">
            {data.languages.map((l: any) => `${l.name} (${l.proficiency})`).join(" • ")}
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ACHIEVEMENTS */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {hasValidAchievements(data) && (
        <div>
          <h2 className="text-sm font-bold text-blue-600 uppercase border-b-2 border-blue-600 pb-2 mb-2">
            Achievements
          </h2>
          <ul className="list-disc list-inside text-gray-700 text-xs space-y-0">
            {data?.achievements?.map((item: any, idx: number) => {
              const text = getAchievementText(item);
              return text ? (
                <li key={idx} className="ml-2">
                  {text}
                </li>
              ) : null;
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TechTemplate;
