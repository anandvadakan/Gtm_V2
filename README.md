# GTM Intelligence Agent v2

AI-powered social listening and GTM intelligence. Real-time data from Reddit, Twitter/X, and Google News with median sentiment scoring and optional launch playbook.

## Features
- AI keyword expansion before scraping (Groq generates 15+ search variants)
- Reddit: posts, comments, subreddit communities
- Twitter/X: 20 tweets max 
- Google News: market signals
- Competitor gap analysis
- Launch playbook mode with pre-launch, launch day, first week actions
- PDF export

## Stack
Frontend: React → Vercel
Backend: Node.js + Express → Render.com
Data: Apify (Reddit + Twitter + News)
AI: Groq (Llama 3.3 70B)
PDF: jsPDF

## Setup
### Backend
```
cd backend
cp .env.example .env  # add GROQ_API_KEY and APIFY_API_KEY
npm install && npm start
```
### Frontend
```
cd frontend
echo "REACT_APP_API_URL=http://localhost:5000" > .env
npm install && npm start
```

## Deploy
- Backend → Render.com: root dir `backend`, env vars GROQ_API_KEY + APIFY_API_KEY
- Frontend → Vercel: root dir `frontend`, env var REACT_APP_API_URL = Render URL
