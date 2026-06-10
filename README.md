# 🚀 AI ATS Resume Builder & Interview Prep Platform

An AI-powered platform that helps job seekers build ATS-friendly resumes, analyze resume-job description compatibility, identify skill gaps, optimize content using AI, and prepare for technical interviews.

Built using **React, Node.js, Express, MongoDB, Redis, and Google Gemini AI**.

---

## 📌 Overview

Most resumes are rejected before reaching recruiters because they fail Applicant Tracking System (ATS) screening.

This platform helps candidates improve their chances by:

* Analyzing resumes against job descriptions
* Generating ATS compatibility scores
* Identifying missing skills and keywords
* Rewriting resume content using AI
* Performing semantic matching beyond exact keyword search
* Generating personalized mock interview questions
* Providing AI-driven feedback and improvement suggestions

---

## ✨ Features

### 📄 ATS Resume Analysis

* ATS score generation (0–100)
* Keyword matching engine
* Semantic similarity analysis
* Resume completeness validation
* Action verb detection
* Formatting evaluation
* Detailed score breakdown

### 🤖 AI Resume Optimization

* AI-powered bullet point rewriting
* Missing keyword suggestions
* Skill gap analysis
* Resume enhancement recommendations
* One-click ATS fixes

### 🎯 AI Mock Interview

* Resume-focused questions
* Job description-focused questions
* Skill-gap-based questions
* AI evaluation and scoring
* Missing concept detection
* Improvement recommendations

### 📝 Resume Builder

* Multiple ATS-friendly templates
* Resume editor dashboard
* Dynamic section management
* PDF export support

### 🛡️ Admin Dashboard

* User analytics
* Resume statistics
* Keyword management
* Platform monitoring

---

## 🏗️ System Architecture

```text
React + Vite Frontend
        │
        ▼
Node.js + Express Backend
        │
 ┌──────┼──────┐
 ▼      ▼      ▼
MongoDB Redis Gemini AI
```

### Core Modules

* Authentication Service
* ATS Scoring Engine
* Resume Parser
* Semantic Matching Engine
* AI Rewrite Engine
* Interview Generator
* PDF Generator
* Admin Analytics

---

## 🛠️ Tech Stack

### Frontend

* React 18
* TypeScript
* Vite
* Tailwind CSS
* Material UI
* Radix UI
* React Router
* Recharts
* Framer Motion

### Backend

* Node.js
* Express.js
* MongoDB
* Mongoose
* Redis
* JWT Authentication
* bcryptjs

### AI & NLP

* Google Gemini API
* Semantic Matching
* Skill Gap Analysis
* Resume Rewriting
* Interview Question Generation

### Development Tools

* Git & GitHub
* Postman
* Nodemon

---

## 🚀 Key Technical Highlights

### Hybrid ATS Scoring Engine

The ATS engine combines:

* Exact keyword matching
* Semantic similarity scoring
* Resume completeness checks
* Formatting analysis
* Action verb detection

### Redis Caching Layer

Implemented multi-level caching for:

* User authentication
* ATS reports
* Semantic embeddings
* AI-generated responses

Benefits:

* Reduced API costs
* Faster ATS scoring
* Improved response times

### AI Resume Rewriter

Automatically:

* Rewrites weak bullet points
* Improves ATS alignment
* Adds missing keywords naturally
* Enhances impact statements

### Interview Preparation Engine

Generates:

* Resume-specific questions
* JD-specific questions
* Skill-gap-based questions
* Technical interview feedback

---

## 📂 Project Structure

```bash
ai-resume/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── b2world-backend1/
│   ├── controllers/
│   ├── services/
│   ├── routes/
│   ├── models/
│   ├── middlewares/
│   ├── utils/
│   ├── config/
│   └── server.js
│
└── README.md
```

---

## ⚙️ Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-username/ai-resume.git
cd ai-resume
```

### 2. Backend Setup

```bash
cd b2world-backend1

npm install

cp .env.example .env

npm run dev
```

Backend runs on:

```text
http://localhost:5000
```

### 3. Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

---

## 🔐 Environment Variables

Create a `.env` file inside `b2world-backend1`.

Example:

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret

REDIS_URL=redis://localhost:6379

CORS_ORIGIN=http://localhost:5173

GEMINI_API_KEY=your_gemini_api_key
```

---

## 📊 Performance Optimizations

* Redis caching for ATS reports
* Redis caching for user sessions
* Semantic result caching
* Reduced database queries
* Reduced AI API calls
* Faster dashboard loading

---

## 🔒 Security Features

* JWT Authentication
* Password hashing using bcryptjs
* Protected API routes
* Role-based admin access
* CORS protection
* Rate limiting
* Helmet security middleware

---

## 🧪 Testing

Run backend tests:

```bash
cd b2world-backend1

npm test
```

## 💼 Skills Demonstrated

This project showcases:

* Full Stack Development
* System Design
* AI Integration
* Caching Strategies
* REST API Development
* Authentication & Authorization
* Database Design
* Performance Optimization
* Resume Intelligence Systems

---

## 👨‍💻 Author

**Tanuja Gunjal**

Built as a full-stack AI platform focused on ATS optimization, resume intelligence, and interview preparation.

