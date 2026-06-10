import React from "react";

interface FresherTemplateProps {
  data: any;
  className?: string;
}

/**
 * FresherTemplate - Modern, minimal resume layout
 * Tighter spacing, modern typography, minimal borders
 */
const FresherTemplate: React.FC<FresherTemplateProps> = ({
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
      className={`bg-white border-2 border-gray-200 rounded-lg p-6 aspect-[8.5/11] overflow-auto shadow-lg text-xs space-y-2 ${className}`}
    >
      {/* Header */}
      {data?.personalInfo && (
        <div className="pb-2 border-b border-indigo-300">
          <h1 className="text-lg font-bold text-gray-900">
            {data.personalInfo.fullName || "Name Not Provided"}
          </h1>
          <p className="text-xs text-indigo-600 font-semibold mb-1">
            {data.personalInfo.email || ""}{" "}
            {data.personalInfo.phone ? `• ${data.personalInfo.phone}` : ""}
          </p>
          <p className="text-xs text-gray-600">
            {data.personalInfo.location || ""}{" "}
            {data.personalInfo.linkedin ? `• ${data.personalInfo.linkedin}` : ""}
          </p>
        </div>
      )}

      {/* Professional Summary */}
      {data?.summary && (
        <div>
          <h2 className="text-xs font-bold text-indigo-600 uppercase">
            About
          </h2>
          <p className="text-xs text-gray-700 leading-snug">{data.summary}</p>
        </div>
      )}

      {/* Skills */}
      {data?.skills && data.skills.length > 0 && data.skills.some((s: any) => s.items?.length > 0) && (
        <div>
          <h2 className="text-xs font-bold text-indigo-600 uppercase">
            Skills
          </h2>
          <div className="space-y-1">
            {data.skills.map((skillGroup: any, idx: number) => (
              <div key={idx} className="text-xs text-gray-700">
                <span className="font-semibold text-gray-900">
                  {skillGroup.category}:{" "}
                </span>
                <span>{skillGroup.items.join(", ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {data?.experience && data.experience.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-indigo-600 uppercase">
            Experience
          </h2>
          <div className="space-y-1.5">
            {data.experience.map((exp: any, idx: number) => (
              <div key={idx}>
                <div className="flex justify-between items-baseline">
                  <h3 className="font-bold text-gray-900 text-xs">
                    {exp.role}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {exp.startDate} -{" "}
                    {exp.current ? "Present" : exp.endDate || "Present"}
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  {exp.company}
                  {exp.location ? ` | ${exp.location}` : ""}
                </p>
                {Array.isArray(exp.bullets) && exp.bullets.length > 0 && (
                  <ul className="list-disc list-inside text-xs text-gray-700 mt-0.5 space-y-0">
                    {exp.bullets.slice(0, 3).map((bullet: string, bIdx: number) => (
                      <li key={bIdx} className="leading-tight">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {data?.education && data.education.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-indigo-600 uppercase">
            Education
          </h2>
          <div className="space-y-1">
            {data.education.map((edu: any, idx: number) => (
              <div key={idx} className="text-xs">
                <h3 className="font-bold text-gray-900">
                  {edu.degree}
                  {edu.field ? ` • ${edu.field}` : ""}
                </h3>
                <p className="text-gray-600">
                  {edu.institution}
                  {edu.endDate ? ` | ${edu.endDate}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projects */}
      {data?.projects && data.projects.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-indigo-600 uppercase">
            Projects
          </h2>
          <div className="space-y-1">
            {data.projects.slice(0, 2).map((proj: any, idx: number) => (
              <div key={idx}>
                <h3 className="font-bold text-gray-900 text-xs">
                  {proj.title}
                </h3>
                {Array.isArray(proj.techStack) && proj.techStack.length > 0 && (
                  <p className="text-xs text-gray-600 italic">
                    {proj.techStack.join(", ")}
                  </p>
                )}
                {Array.isArray(proj.bullets) && proj.bullets.length > 0 && (
                  <ul className="list-disc list-inside text-xs text-gray-700 space-y-0">
                    {proj.bullets.slice(0, 2).map((bullet: string, bIdx: number) => (
                      <li key={bIdx} className="leading-tight text-gray-700">
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certifications */}
      {data?.certifications && data.certifications.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-indigo-600 uppercase">
            Certifications
          </h2>
          {data.certifications.slice(0, 3).map((cert: any, idx: number) => (
            <div key={idx} className="text-xs text-gray-700">
              <span className="font-semibold">{cert.name}</span>
              {cert.issuer && <span> • {cert.issuer}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Languages */}
      {data?.languages && data.languages.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-indigo-600 uppercase">
            Languages
          </h2>
          <p className="text-xs text-gray-700">
            {data.languages.map((l: any) => `${l.name} (${l.proficiency})`).join(" • ")}
          </p>
        </div>
      )}

      {/* Achievements */}
      {hasValidAchievements(data) && (
        <div>
          <h2 className="text-xs font-bold text-indigo-600 uppercase">
            Achievements
          </h2>
          <ul className="list-disc list-inside text-xs text-gray-700 space-y-0">
            {data?.achievements?.slice(0, 3).map((item: any, idx: number) => {
              const text = getAchievementText(item);
              return text ? (
                <li key={idx} className="leading-tight">
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

export default FresherTemplate;
