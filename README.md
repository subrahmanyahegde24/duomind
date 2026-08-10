# DuoMind 🧠

DuoMind is a highly secure, high-performance, full-stack AI chatbot developed by Kruthak Technology Pvt Ltd. It boasts an incredibly sleek and fast UI (Next.js), powered by a secure serverless Python backend (FastAPI), utilizing Google's Gemini LLM.

## 🚀 Key Features

*   **Real-time Streaming AI**: Letter-by-letter streaming interface mimicking human typing.
*   **State-of-the-Art Memory Encryption**: Conversations are heavily compressed using `lzma` and encrypted using AES-128-CBC (`cryptography.fernet`) *before* being stored in the database.
*   **MongoDB Atlas Architecture**: Fully relational and scalable long-term chat history hosted on the cloud.
*   **Two-Factor Authentication (2FA)**: Fully integrated Authenticator-based Time-based One-Time Password (TOTP) utilizing Supabase Auth.
*   **Full Session Management**: Create, view, rename, and securely delete past AI conversation threads.
*   **Serverless Ready**: Built natively for Vercel's Edge and Serverless functions.

---

## ☁️ Vercel Deployment Guide

Deploying DuoMind to Vercel is completely free and requires zero servers. Vercel natively supports both the Next.js frontend and the FastAPI python backend.

### 1. Push to GitHub
First, push this entire project to a single GitHub repository.

### 2. Deploy the Backend (FastAPI)
The backend uses Vercel's `@vercel/python` engine to automatically convert your FastAPI app into Serverless Functions.

1. Go to [Vercel](https://vercel.com/new).
2. Import your GitHub repository.
3. Under **Framework Preset**, leave it as `Other`.
4. Under **Root Directory**, click **Edit** and select the `backend` folder.
5. Expand **Environment Variables** and add the following securely:

| Variable Name | Description | Example |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Your Google Gemini API Key | `AIzaSy...` |
| `SUPABASE_URL` | Your Supabase Project URL | `https://xyz.supabase.co` |
| `SUPABASE_KEY` | Your Supabase public anon key | `eyJhb...` |
| `MONGO_URI` | Your MongoDB Atlas Connection String | `mongodb+srv://...` |
| `ENCRYPTION_KEY` | **CRITICAL:** A secure base64 AES key. Generate using `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` | `...` |

6. Click **Deploy**. Vercel will process `vercel.json` and deploy your API! Note the URL it gives you (e.g., `https://duomind-backend.vercel.app`).

### 3. Deploy the Frontend (Next.js)
1. Go back to Vercel and import the *same* GitHub repository again.
2. Under **Root Directory**, select the `frontend` folder. Vercel will automatically detect that this is a **Next.js** project.
3. Expand **Environment Variables** and add:

| Variable Name | Description | Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_BACKEND_URL` | The Vercel URL of your newly deployed Backend | `https://duomind-backend.vercel.app` |

4. Click **Deploy**. You are now live!

---

## 🛡️ CI/CD & Security Checks
This project includes a native GitHub Actions pipeline (`.github/workflows/security-ci.yml`). 
Whenever you push code to GitHub:
1. **Frontend:** `npm audit` scans your Node.js dependencies for vulnerabilities and runs a production test build.
2. **Backend:** `bandit` statically analyzes the Python codebase for security flaws and injection vulnerabilities.
3. **Vercel (CD):** Once the security checks pass, Vercel automatically picks up the GitHub push and hot-reloads your live production environment!

---

## 🛠️ Local Development

If you wish to run DuoMind locally:

**1. Start the Backend:**
```bash
cd backend
uv sync # or pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
*(Ensure your `.env` is present in the `backend` folder)*

**2. Start the Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Enjoy DuoMind!
