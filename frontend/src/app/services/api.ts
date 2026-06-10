/**
 * Production-Grade API Service
 * Fixed: Empty response handling, proper score extraction, all API exports
 * Auth: Centralized 401/expired-token handling with auto-logout + redirect
 */

const API_BASE = 'http://localhost:5000/api';

// ---------------------------------------------------------------------------
// Centralized auth-failure handler
// ---------------------------------------------------------------------------

/** Routes that are allowed without a token (never trigger the 401 guard). */
const PUBLIC_ENDPOINTS = ['/auth/login', '/auth/register'];

/**
 * Optional logout callback registered by AuthContext.
 * Calling this ensures React state (user / token) is wiped, not just localStorage.
 */
let _logoutCallback: (() => void) | null = null;

/** Called by AuthProvider once on mount so the API layer can clear React state on 401. */
export const setLogoutCallback = (fn: () => void): void => {
  _logoutCallback = fn;
};

/**
 * Perform a forced logout:
 *  1. Clear persisted auth data
 *  2. Call React-level logout (if registered)
 *  3. Redirect to /auth
 */
const handleSessionExpired = (): void => {
  console.warn('[API] Session expired → clearing auth and redirecting to /auth');

  localStorage.removeItem('token');
  localStorage.removeItem('user');

  if (_logoutCallback) {
    try { _logoutCallback(); } catch { /* ignore */ }
  }

  // Show a brief notification before redirect (works without a toast library)
  if (typeof window !== 'undefined') {
    // Only redirect if we are not already on the auth page to avoid redirect loops
    if (!window.location.pathname.startsWith('/auth')) {
      alert('Your session has expired. Please log in again.');
      window.location.href = '/auth';
    }
  }
};

// Helper to extract score from various response formats
const extractScore = (data: any): number | null => {
  if (!data) return null;
  if (typeof data.totalScore === 'number') return data.totalScore;
  if (typeof data.score === 'number') return data.score;
  if (data.totalScore && typeof data.totalScore === 'object') return data.totalScore.totalScore;
  if (data.score && typeof data.score === 'object') return data.score.totalScore;
  return null;
};

// Helper to normalize breakdown from various backend formats
const normalizeBreakdown = (breakdown: any) => {
  if (!breakdown) return null;
  
  const getScore = (key: string) => {
    if (breakdown[key]?.score !== undefined) return breakdown[key].score;
    if (breakdown[key] !== undefined) return breakdown[key];
    return 0;
  };
  
  return {
    keywordMatch: getScore('keywordMatch') || getScore('keywordMatchScore') || 0,
    completeness: getScore('completeness') || getScore('sectionCompletenessScore') || 0,
    formatting: getScore('formatting') || getScore('formattingScore') || 0,
    actionVerbs: getScore('actionVerbs') || getScore('actionVerbScore') || 0,
    readability: getScore('readability') || getScore('readabilityScore') || 0
  };
};

// Helper to normalize suggestions
const normalizeSuggestions = (suggestions: any[]) => {
  if (!Array.isArray(suggestions)) return [];
  
  return suggestions.map((s: any) => ({
    id: s.id || `sugg-${Math.random().toString(36).substr(2, 9)}`,
    section: s.section || '',
    itemIndex: s.itemIndex ?? undefined,
    bulletIndex: s.bulletIndex ?? undefined,
    currentText: s.currentText || '',
    improvedText: s.improvedText || s.suggestedText || '',
    impact: s.impact || 'medium',
    reason: s.reason || '',
    type: s.type || 'content',
  }));
};

// Get auth token helper
export const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
};

// Remove auth token helper
export const removeAuthToken = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// API fetch helper - Fixed to handle empty responses + centralized 401 handling
const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const token = localStorage.getItem('token');
  const isPublic = PUBLIC_ENDPOINTS.some(p => endpoint.startsWith(p));

  // ── Safe token guard ─────────────────────────────────────────────────────
  // For protected routes: if there is no token at all, short-circuit immediately.
  if (!isPublic && !token) {
    console.warn(`[API] No token found for protected endpoint "${endpoint}" → redirecting to /auth`);
    handleSessionExpired();
    throw new Error('No authentication token found. Please log in.');
  }

  const headers: any = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };
  
  // Don't set Content-Type for FormData, let the browser set it with the boundary
  if (!(options.body instanceof FormData)) {
    // Only set default if not overridden
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    cache: options.cache || 'default'
  });

  // ── 401 Unauthorized (expired / invalid token) ───────────────────────────
  if (response.status === 401 && !isPublic) {
    console.warn(`[API] 401 received for "${endpoint}" → session expired`);
    handleSessionExpired();
    throw new Error('Session expired. Please log in again.');
  }
  
  // Handle empty responses
  const text = await response.text();
  if (!text || text.trim() === '') {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Server returned no content`);
    }
    throw new Error('Server returned empty response. Please check if the backend is running correctly.');
  }
  
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('Failed to parse JSON response:', text.substring(0, 200));
    throw new Error(`Invalid JSON response from server: ${text.substring(0, 100)}`);
  }
  
  if (!response.ok) {
    const errorMessage = data?.message || data?.error || `HTTP error ${response.status}`;
    throw new Error(errorMessage);
  }
  
  return data;
};

// ATS Score API
export const atsAPI = {
  calculateScore: async (resumeId: string) => {
    const data = await apiFetch('/ats/score', {
      method: 'POST',
      body: JSON.stringify({ resumeId })
    });

    // Backend returns flat response: { success, score, breakdown, suggestions, ... }
    // NOT nested under data.data
    const inner = data;
    return {
      success:         data.success,
      totalScore:      extractScore(inner),
      scoringMode:     inner.scoringMode || 'job-specific',
      message:         inner.message || '',
      breakdown:       normalizeBreakdown(inner.breakdown) || {},
      missingKeywords: inner.missingKeywords || [],
      missingSections: inner.missingSections || [],
      suggestions:     normalizeSuggestions(inner.suggestions || []),
      overallFeedback: inner.overallFeedback || {},
      // raw payload available for skill gap fields
      data: inner,
    };
  },
  
  getSuggestions: async (resumeId: string, jdId?: string) => {
    const data = await apiFetch('/ats/suggestions', {
      method: 'POST',
      body: JSON.stringify({ resumeId, jdId })
    });

    const inner = data.data || {};
    return {
      success:     data.success,
      suggestions: normalizeSuggestions(inner.suggestions || []),  // ← top level
      count:       inner.count || 0,
      data: inner,
    };
  },
  
  applySuggestion: async (resumeId: string, jobDescriptionId: string, options: any) => {
    const { 
      section, 
      itemIndex, 
      bulletIndex, 
      improvedText, 
      suggestedText,
      suggestionId,
      currentText
    } = options;

    const data = await apiFetch('/ats/apply-suggestion', {
      method: 'POST',
      body: JSON.stringify({
        resumeId,
        jobDescriptionId,
        section,
        itemIndex,
        bulletIndex,
        improvedText:    improvedText || suggestedText,
        suggestedText:   suggestedText || improvedText,
        suggestionId:    suggestionId  || undefined,
        currentText:     currentText   || undefined,
        autoApplicable:  true,
        targetIndex: {
          expIndex:    itemIndex,
          projIndex:   itemIndex,
          bulletIndex: bulletIndex,
          index:       itemIndex
        }
      })
    });

    return {
      success: data.success,
      message: data.message,
      data: {
        updatedScore: extractScore(data.data?.updatedScore),
        updatedBreakdown: normalizeBreakdown(data.data?.updatedBreakdown),
        updatedSuggestions: normalizeSuggestions(data.data?.updatedSuggestions || []),
        missingKeywords: data.data?.missingKeywords || [],
        overallFeedback: data.data?.overallFeedback || {},
      }
    };
  },

  applyAllSuggestions: async (resumeId: string, jobDescriptionId: string) => {
    const data = await apiFetch('/ats/apply-all-suggestions', {
      method: 'POST',
      body: JSON.stringify({ resumeId, jobDescriptionId })
    });

    return {
      success: data.success,
      message: data.message,
      data: {
        appliedCount:            data.data?.appliedCount,
        updateCount:             data.data?.updateCount,
        updatedScore:            extractScore(data.data?.updatedScore) ?? extractScore(data.data),
        scoringMode:             data.data?.scoringMode,
        updatedBreakdown:        normalizeBreakdown(data.data?.updatedBreakdown),
        updatedSuggestions:      normalizeSuggestions(data.data?.updatedSuggestions || []),
        missingKeywords:         data.data?.missingKeywords || [],
        overallFeedback:         data.data?.overallFeedback || {},
        missingSections:         data.data?.missingSections || [],
      }
    };
  },

  generateResume: async (resumeId: string, mode: string) => {
    const data = await apiFetch('/ats/generate', {
      method: 'POST',
      body: JSON.stringify({ resumeId, mode })
    });
    
    return {
      success: data.success,
      data: data.data
    };
  },

  getSkillGap: async (resumeId: string, jdId: string) => {
    return await apiFetch(`/ats/skill-gap/${resumeId}/${jdId}`);
  },

  autoFixSkillGap: async (resumeId: string, jdId: string) => {
    const data = await apiFetch(`/ats/auto-fix/${resumeId}/${jdId}`, { method: 'POST' });
    return {
      success:   data.success,
      message:   data.message,
      data: {
        scoreBefore:              data.data?.scoreBefore  ?? null,
        scoreAfter:               data.data?.scoreAfter   ?? null,
        addedKeywords:            data.data?.addedKeywords ?? [],
        contextKeywordsInjected:  data.data?.contextKeywordsInjected ?? [],
        updatedBreakdown:         normalizeBreakdown(data.data?.updatedBreakdown),
        predictedScore:           data.data?.predictedScore ?? null,
      }
    };
  },

  rewriteResume: async (resumeId: string) => {
    const data = await apiFetch('/ats/rewrite', {
      method: 'POST',
      body: JSON.stringify({ resumeId }),
    });
    return {
      success:      data.success,
      message:      data.message,
      isFallback:   data.data?.isFallback ?? false,
      originalScore: data.data?.originalScore ?? null,
      newScore:     data.data?.newScore ?? null,
      scoreDelta:   data.data?.scoreDelta ?? 0,
      diff:         data.data?.diff ?? { summary: { before: '', after: '' }, projects: [], skills: { added: [] } },
      rewrittenResume: data.data?.rewrittenResume ?? null,
      improvements: data.data?.improvements ?? [],
    };
  },

  generateInterview: async (resumeId: string, jdId: string) => {
    const data = await apiFetch('/interview/generate', {
      method: 'POST',
      body: JSON.stringify({ resumeId, jdId })
    });
    return data;
  },

  evaluateAnswer: async (question: string, answer: string, context: any) => {
    const data = await apiFetch('/interview/evaluate', {
      method: 'POST',
      body: JSON.stringify({ question, answer, context })
    });
    return data;
  }
};

// JD API
export const jdAPI = {
  analyzeJD: async (jdText: string, resumeId?: string, options?: any) => {
    const body: any = { jdText };
    if (resumeId) body.resumeId = resumeId;
    const data = await apiFetch('/jd/analyze', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    
    return {
      success: data.success,
      data: data.data
    };
  },
  
  getJD: async (jdId: string) => {
    const data = await apiFetch(`/jd/${jdId}`);
    return { success: data.success, data: data.data };
  },
  
  optimizeResume: async (jdId: string, resumeId: string) => {
    const data = await apiFetch('/jd/optimize', {
      method: 'POST',
      body: JSON.stringify({ jdId, existingResumeId: resumeId })
    });
    
    return {
      success: data.success,
      data: data.data
    };
  },
  
  generateFromJD: async (jdId: string, resumeIdOrOptions?: string | any, options?: any) => {
    let resumeId: string | undefined;
    let opts: any;
    
    if (typeof resumeIdOrOptions === 'string') {
      resumeId = resumeIdOrOptions;
      opts = options;
    } else if (resumeIdOrOptions && typeof resumeIdOrOptions === 'object') {
      opts = resumeIdOrOptions;
    }
    
    const data = await apiFetch('/jd/generate-resume', {
      method: 'POST',
      body: JSON.stringify({ jdId, resumeId, ...opts })
    });
    
    return {
      success: data.success,
      data: data.data
    };
  }
};

// Resume API
export const resumeAPI = {
  getAll: async (options?: { signal?: AbortSignal }) => {
    return resumeAPI.getMyResumes(options);
  },
  
  getMyResumes: async (options?: { signal?: AbortSignal }) => {
    const data = await apiFetch('/resume', {
      signal: options?.signal,
      cache: 'no-store',
    });
    return { success: data.success, data: data.data };
  },
  
  get: async (resumeId: string) => {
    const data = await apiFetch(`/resume/${resumeId}`);
    const resumeData = data.data?.resume ?? data.data;
    return { success: data.success, data: resumeData };
  },
  
  getResumeById: async (resumeId: string) => {
    return resumeAPI.get(resumeId);
  },
  
  create: async (resumeData: any) => {
    const data = await apiFetch('/resume/create', {
      method: 'POST',
      body: JSON.stringify(resumeData)
    });
    return { success: data.success, data: data.data };
  },
  
  createResume: async (resumeData: any) => {
    return resumeAPI.create(resumeData);
  },
  
  uploadResume: async (file: File) => {
    const formData = new FormData();
    formData.append('resume', file);
    
    const data = await apiFetch('/resume/upload', {
      method: 'POST',
      body: formData
    });
    return { success: data.success, data: data.data };
  },
  
  update: async (resumeId: string, resumeData: any) => {
    const data = await apiFetch(`/resume/update/${resumeId}`, {
      method: 'PUT',
      body: JSON.stringify(resumeData)
    });
    return { success: data.success, data: data.data };
  },
  
  updateResume: async (resumeId: string, resumeData: any) => {
    return resumeAPI.update(resumeId, resumeData);
  },

  updateTemplate: async (resumeId: string, templateId: string) => {
    const data = await apiFetch(`/resume/${resumeId}/template`, {
      method: 'PATCH',
      body: JSON.stringify({ templateId })
    });
    return { success: data.success, data: data.data };
  },
  
  delete: async (resumeId: string) => {
    const data = await apiFetch(`/resume/delete/${resumeId}`, {
      method: 'DELETE'
    });
    return { success: data.success };
  },
  
  deleteResume: async (resumeId: string) => {
    return resumeAPI.delete(resumeId);
  },
  
  downloadPDF: async (resumeId: string): Promise<Blob> => {
    const token = localStorage.getItem('token');

    // Safe token guard for manual fetch
    if (!token) {
      console.warn('[API] downloadPDF: No token → redirecting to /auth');
      handleSessionExpired();
      throw new Error('No authentication token found. Please log in.');
    }

    const response = await fetch(`${API_BASE}/resume/download/pdf/${resumeId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Handle 401 from download endpoint
    if (response.status === 401) {
      console.warn('[API] downloadPDF: 401 received → session expired');
      handleSessionExpired();
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      let message = `Download failed (${response.status})`;
      try {
        const errData = await response.json();
        message = errData.message || message;
      } catch {}
      throw new Error(message);
    }

    return response.blob();
  }
};

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (data.success && data.data?.token) {
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    
    return { success: data.success, data: data.data };
  },
  
  register: async (name: string, email: string, password: string) => {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    
    if (data.success && data.data?.token) {
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    
    return { success: data.success, data: data.data };
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
};

// Admin API
export const adminAPI = {
  getStats: async () => {
    const data = await apiFetch('/admin/stats');
    return { success: data.success, data: data.data };
  },

  getActivity: async (limit = 10) => {
    const data = await apiFetch(`/admin/activity?limit=${limit}`);
    return { success: data.success, data: data.data };
  },
  
  getUsers: async (options?: { page?: number; limit?: number; search?: string }) => {
    const page = options?.page || 1;
    const limit = options?.limit || 100;
    const search = options?.search ? `&search=${encodeURIComponent(options.search)}` : '';
    const data = await apiFetch(`/admin/users?page=${page}&limit=${limit}${search}`);
    return { success: data.success, data: data.data };
  },
  
  getResumes: async (page = 1, limit = 20) => {
    const data = await apiFetch(`/admin/resumes?page=${page}&limit=${limit}`);
    return { success: data.success, data: data.data };
  },
  
  getKeywords: async () => {
    const data = await apiFetch('/admin/keywords');
    return { success: data.success, data: data.data };
  },
  
  addRoleKeywordLibrary: async (role: string) => {
    const data = await apiFetch('/admin/keywords/role', {
      method: 'POST',
      body: JSON.stringify({ role })
    });
    return { success: data.success, data: data.data };
  },
  
  deleteRoleKeywordLibrary: async (role: string) => {
    const data = await apiFetch(`/admin/keywords/role/${encodeURIComponent(role)}`, {
      method: 'DELETE'
    });
    return { success: data.success };
  },
  
  addKeywordToRole: async (role: string, keyword: string) => {
    const data = await apiFetch('/admin/keywords/add', {
      method: 'POST',
      body: JSON.stringify({ role, keyword })
    });
    return { success: data.success, data: data.data };
  },
  
  removeKeywordFromRole: async (role: string, keyword: string) => {
    const data = await apiFetch('/admin/keywords/remove', {
      method: 'DELETE',
      body: JSON.stringify({ role, keyword })
    });
    return { success: data.success, data: data.data };
  },
  
  addKeyword: async (keyword: any) => {
    const data = await apiFetch('/admin/keywords', {
      method: 'POST',
      body: JSON.stringify(keyword)
    });
    return { success: data.success, data: data.data };
  },
  
  deleteKeyword: async (keywordId: string) => {
    const data = await apiFetch(`/admin/keywords/${keywordId}`, {
      method: 'DELETE'
    });
    return { success: data.success };
  },
  
  getTemplates: async () => {
    const data = await apiFetch('/admin/templates');
    return { success: data.success, data: data.data };
  },
  
  getSuggestionRules: async () => {
    const data = await apiFetch('/admin/suggestion-rules');
    return { success: data.success, data: data.data };
  },
  
  // Backward-compat alias used by older callers/bundles
  getSuggestionsRules: async () => {
    const data = await apiFetch('/admin/suggestion-rules');
    return { success: data.success, data: data.data };
  },
  
  updateSuggestionRules: async (ruleId: string, ruleData: any) => {
    const data = await apiFetch(`/admin/suggestion-rules/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify(ruleData)
    });
    return { success: data.success, data: data.data };
  },
  
  generateInterview: async (resumeId: string, jdId: string) => {
    const data = await apiFetch('/interview/generate', {
      method: 'POST',
      body: JSON.stringify({ resumeId, jdId })
    });
    return data;
  },

  evaluateAnswer: async (question: string, answer: string, context: any) => {
    const data = await apiFetch('/interview/evaluate', {
      method: 'POST',
      body: JSON.stringify({ question, answer, context })
    });
    return data;
  }
};

// AI API
export const aiAPI = {
  improveResume: async (resumeId: string, jdId: string) => {
    const data = await apiFetch('/ai/improve', {
      method: 'POST',
      body: JSON.stringify({ resumeId, jdId })
    });
    return { success: data.success, data: data.data };
  }
};

export default {
  ats: atsAPI,
  jd: jdAPI,
  resume: resumeAPI,
  auth: authAPI,
  admin: adminAPI,
  ai: aiAPI,
  getAuthToken,
  removeAuthToken
};
