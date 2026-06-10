import React from "react";

interface ClassicTemplateProps {
  data: any;
  className?: string;
}

/**
 * ClassicTemplate - Professional, traditional resume layout
 * Centered header, standard sections, clean typography
 */
const ClassicTemplate: React.FC<ClassicTemplateProps> = ({
  data,
  className = ""
}) => {
  const hasValidAchievements = (resume: any): boolean => {
    if (!resume?.achievements) return false;
    if (!Array.isArray(resume.achievements)) return false;
    return resume.achievements.some((item: any) => {
      if (typeof item === "string") return item.trim().length > 0;
      if (typeof item === "object" && item !== null)
        return Object.values(item).some(
          (v) => typeof v === "string" && v.trim().length > 0
        );
      return false;
    });
  };

  const getAchievementText = (item: any): string | undefined => {
    if (typeof item === "string") return item.trim() || undefined;
    if (typeof item === "object" && item !== null) {
      return (Object.values(item) as any[]).find(
        (v) => typeof v === "string" && v.trim().length > 0
      ) as string | undefined;
    }
    return undefined;
  };

  return (
    <div
      className={`bg-white border-2 border-gray-300 rounded-lg p-8 aspect-[8.5/11] overflow-auto shadow-lg text-xs ${className}`}
    >
      {/* Header */}
      {data?.personalInfo && (
        <div className="text-center mb-4 pb-3 border-b-2 border-gray-900">
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            {data.personalInfo.fullName?.toUpperCase() || "Name Not Provided"}
          </h1>
          <div className="text-xs text-gray-600 space-y-0.5">
            <p>
              {data.personalInfo.email || ""}{" "}
              {data.personalInfo.phone ? `| ${data.personalInfo.phone}` : ""}
            </p>
            <p>
              {data.personalInfo.location || ""}{" "}
              {data.personalInfo.linkedin ? `| ${data.personalInfo.linkedin}` : ""}
            </p>
          </div>
        </div>
      )}

      {/* Professional Summary */}
      {data?.summary && (
        <div className="mb-3">
          <h2 className="text-sm font-bold text-gray-900 mb-1 uppercase">
            Professional Summary
          </h2>
          <p className="text-xs text-gray-700 leading-relaxed">
            {data.summary}
          </p>
        </div>
      )}

      {/* Skills */}
      {data?.skills && data.skills.length > 0 && data.skills.some((s: any) => s.items?.length > 0) && (
        <div className="mb-3">
          <h2 className="text-sm font-bold text-gray-900 mb-1 uppercase border-b border-gray-300 pb-0.5">
            Skills
          </h2>
          {data.skills.map((skillGroup: any, idx: number) => (
            <div key={idx} className="text-xs text-gray-700 mb-0.5">
              <span className="font-semibold">{skillGroup.category}: </span>
              <span>{skillGroup.items.join(" • ")}</span>
            </div>
          ))}
        </div>
      )}

      {/* Experience */}
      {data?.experience && data.experience.length > 0 && (
        <div className="mb-3">
          <h2 className="text-sm font-bold text-gray-900 mb-1 uppercase border-b border-gray-300 pb-0.5">
            Work Experience
          </h2>
          {data.experience.map((exp: any, idx: number) => (
            <div key={idx} className="mb-2">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-gray-900 text-xs">{exp.role}</h3>
                <span className="text-xs text-gray-600">
                  {exp.startDate} -{" "}
                  {exp.current ? "Present" : exp.endDate || "Present"}
                </span>
              </div>
              <p className="text-xs text-gray-700 italic mb-0.5">
                {exp.company}
                {exp.location ? ` | ${exp.location}` : ""}
              </p>
              {Array.isArray(exp.bullets) && exp.bullets.length > 0 && (
                <ul className="list-disc list-inside text-xs text-gray-700 space-y-0.5">
                  {exp.bullets.map((bullet: string, bIdx: number) => (
                    <li key={bIdx}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {data?.education && data.education.length > 0 && (
        <div className="mb-3">
          <h2 className="text-sm font-bold text-gray-900 mb-1 uppercase border-b border-gray-300 pb-0.5">
            Education
          </h2>
          {data.education.map((edu: any, idx: number) => (
            <div key={idx} className="text-xs mb-1">
              <h3 className="font-bold text-gray-900">
                {edu.degree}
                {edu.field ? ` in ${edu.field}` : ""}
              </h3>
              <p className="text-gray-700">
                {edu.institution}
                {edu.location ? ` | ${edu.location}` : ""}
                {edu.endDate ? ` | ${edu.endDate}` : ""}
                {edu.grade ? ` | ${edu.grade}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Projects */}
      {data?.projects && data.projects.length > 0 && (
        <div className="mb-3">
          <h2 className="text-sm font-bold text-gray-900 mb-1 uppercase border-b border-gray-300 pb-0.5">
            Projects
          </h2>
          {data.projects.map((proj: any, idx: number) => (
            <div key={idx} className="mb-2">
              <h3 className="font-bold text-gray-900 text-xs">{proj.title}</h3>
              {Array.isArray(proj.techStack) && proj.techStack.length > 0 && (
                <p className="text-xs text-gray-600 italic">
                  Tech Stack: {proj.techStack.join(", ")}
                </p>
              )}
              {proj.description && (
                <p className="text-xs text-gray-700">{proj.description}</p>
              )}
              {Array.isArray(proj.bullets) && proj.bullets.length > 0 && (
                <ul className="list-disc list-inside text-xs text-gray-700 space-y-0.5">
                  {proj.bullets.map((bullet: string, bIdx: number) => (
                    <li key={bIdx}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Certifications */}
      {data?.certifications && data.certifications.length > 0 && (
        <div className="mb-3">
          <h2 className="text-sm font-bold text-gray-900 mb-1 uppercase border-b border-gray-300 pb-0.5">
            Certifications
          </h2>
          {data.certifications.map((cert: any, idx: number) => (
            <div key={idx} className="text-xs text-gray-700 mb-0.5">
              <span className="font-semibold">{cert.name}</span>
              {cert.issuer && <span> — {cert.issuer}</span>}
              {cert.date && <span> ({cert.date})</span>}
            </div>
          ))}
        </div>
      )}

      {/* Languages */}
      {data?.languages && data.languages.length > 0 && (
        <div className="mb-3">
          <h2 className="text-sm font-bold text-gray-900 mb-1 uppercase border-b border-gray-300 pb-0.5">
            Languages
          </h2>
          <p className="text-xs text-gray-700">
            {data.languages.map((l: any) => `${l.name} (${l.proficiency})`).join(" • ")}
          </p>
        </div>
      )}

      {/* Achievements */}
      {hasValidAchievements(data) && (
        <div className="mb-3">
          <h2 className="text-sm font-bold text-gray-900 mb-1 uppercase border-b border-gray-300 pb-0.5">
            Achievements
          </h2>
          <ul className="list-disc list-inside text-xs text-gray-700">
            {data?.achievements?.map((item: any, idx: number) => {
              const text = getAchievementText(item);
              return text ? <li key={idx}>{text}</li> : null;
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ClassicTemplate;
