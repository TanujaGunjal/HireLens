# B2World ATS Backend - API Testing Guide

## Setup

Base URL: `http://localhost:5000`

For all authenticated requests, include:
```
Authorization: Bearer <your_token>
```

## 1. Authentication

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "USER"
    }
  }
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### Get Profile
```http
GET /api/auth/me
Authorization: Bearer <token>
```

## 2. Resume Management

### Create Resume
```http
POST /api/resume/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "resumeTitle": "Software Engineer Resume",
  "personalInfo": {
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "location": "New York, NY",
    "linkedin": "linkedin.com/in/johndoe",
    "github": "github.com/johndoe"
  },
  "summary": "Experienced software engineer with 5+ years...",
  "skills": [
    {
      "category": "Programming Languages",
      "items": ["JavaScript", "Python", "Java"]
    },
    {
      "category": "Frameworks",
      "items": ["React", "Node.js", "Express"]
    }
  ],
  "experience": [
    {
      "company": "Tech Corp",
      "role": "Senior Developer",
      "location": "New York, NY",
      "startDate": "Jan 2020",
      "endDate": "Present",
      "current": true,
      "bullets": [
        "Developed scalable microservices using Node.js",
        "Led team of 5 developers"
      ]
    }
  ],
  "projects": [
    {
      "title": "E-commerce Platform",
      "techStack": ["React", "Node.js", "MongoDB"],
      "bullets": [
        "Built full-stack e-commerce platform",
        "Integrated payment gateway"
      ]
    }
  ],
  "education": [
    {
      "institution": "University of Technology",
      "degree": "Bachelor of Science",
      "field": "Computer Science",
      "endDate": "2019",
      "grade": "3.8 GPA"
    }
  ],
  "templateId": "classic"
}
```

### Get My Resumes
```http
GET /api/resume/my-resumes
Authorization: Bearer <token>
```

### Get Resume by ID
```http
GET /api/resume/{resumeId}
Authorization: Bearer <token>
```

### Update Resume
```http
PUT /api/resume/update/{resumeId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "summary": "Updated summary text..."
}
```

### Delete Resume
```http
DELETE /api/resume/delete/{resumeId}
Authorization: Bearer <token>
```

### Download Resume PDF
```http
GET /api/resume/download/pdf/{resumeId}
Authorization: Bearer <token>
```

## 3. Job Description Analysis

### Analyze JD
```http
POST /api/jd/analyze
Authorization: Bearer <token>
Content-Type: application/json

{
  "jdText": "We are looking for a Full Stack Developer with expertise in React, Node.js, and MongoDB. Must have 3+ years of experience...",
  "resumeId": "optional_resume_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "JD analyzed successfully",
  "data": {
    "jd": {
      "_id": "...",
      "roleDetected": "Full Stack Developer",
      "experienceLevel": "Mid",
      "extractedKeywords": [
        {
          "keyword": "React",
          "frequency": 3,
          "category": "skill"
        }
      ]
    },
    "extracted": {
      "role": "Full Stack Developer",
      "skills": ["React", "Node.js", "MongoDB"],
      "responsibilities": [...],
      "qualifications": [...]
    }
  }
}
```

### Generate Resume from JD
```http
POST /api/jd/generate-resume
Authorization: Bearer <token>
Content-Type: application/json

{
  "jdId": "jd_id_from_analyze",
  "optimizeExisting": false
}
```

For optimizing existing resume:
```json
{
  "jdId": "jd_id_from_analyze",
  "optimizeExisting": true,
  "existingResumeId": "resume_id"
}
```

## 4. ATS Scoring

### Calculate ATS Score
```http
POST /api/ats/score
Authorization: Bearer <token>
Content-Type: application/json

{
  "resumeId": "resume_id",
  "jdId": "jd_id (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "ATS score calculated",
  "data": {
    "report": {
      "totalScore": 75,
      "breakdown": {
        "keywordMatchScore": {
          "score": 80,
          "weight": 40,
          "details": {
            "matchedKeywords": ["React", "Node.js"],
            "totalJDKeywords": 10,
            "matchPercentage": 80
          }
        },
        "sectionCompletenessScore": {
          "score": 85,
          "weight": 20
        }
      },
      "missingKeywords": [
        {
          "keyword": "Docker",
          "category": "tool",
          "importance": "Important"
        }
      ],
      "suggestions": [...],
      "overallFeedback": {
        "strengths": ["Strong keyword alignment"],
        "weaknesses": ["Missing certifications"],
        "recommendations": [...]
      }
    }
  }
}
```

### Get Suggestions
```http
POST /api/ats/suggestions
Authorization: Bearer <token>
Content-Type: application/json

{
  "resumeId": "resume_id",
  "jdId": "jd_id (optional)"
}
```

### Apply Suggestion
```http
POST /api/ats/apply-suggestion
Authorization: Bearer <token>
Content-Type: application/json

{
  "resumeId": "resume_id",
  "suggestionId": "sugg-1",
  "section": "summary",
  "suggestedText": "Improved text..."
}
```

## 5. Admin APIs (Requires Admin Role)

### Get All Users
```http
GET /api/admin/users?page=1&limit=20&search=john
Authorization: Bearer <admin_token>
```

### Get Statistics
```http
GET /api/admin/stats
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalUsers": 150,
      "totalResumes": 450,
      "totalDownloads": 1200,
      "activeUsers": 145
    },
    "recentUsers": [...],
    "recentResumes": [...]
  }
}
```

### Get All Templates
```http
GET /api/admin/templates
Authorization: Bearer <admin_token>
```

### Create Template
```http
POST /api/admin/template/create
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "templateName": "creative",
  "displayName": "Creative Design",
  "description": "Modern creative template",
  "category": "Creative",
  "status": "active",
  "isATSFriendly": true
}
```

### Update Template
```http
PUT /api/admin/template/update/{templateId}
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "status": "inactive"
}
```

### Get Keyword Libraries
```http
GET /api/admin/keywords
Authorization: Bearer <admin_token>
```

### Add Keyword Library
```http
POST /api/admin/keywords/add
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "role": "DevOps Engineer",
  "category": "Technical",
  "keywords": [
    {
      "term": "Docker",
      "category": "tool",
      "weight": 5
    },
    {
      "term": "Kubernetes",
      "category": "tool",
      "weight": 5
    }
  ],
  "actionVerbs": ["Deployed", "Automated", "Managed"],
  "isActive": true
}
```

### Update Keyword Library
```http
PUT /api/admin/keywords/update/{libraryId}
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "keywords": [...]
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "msg": "Email is required",
      "param": "email"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied. Admin privileges required."
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

## Testing with cURL

Save your token:
```bash
export TOKEN="your_jwt_token_here"
```

Then use:
```bash
curl -X GET http://localhost:5000/api/resume/my-resumes \
  -H "Authorization: Bearer $TOKEN"
```

## Testing with Postman

1. Import the API collection
2. Set environment variable `baseUrl` = `http://localhost:5000`
3. Set environment variable `token` after login
4. Use `{{baseUrl}}` and `{{token}}` in requests
