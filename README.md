# 🚀 ASTRA – Phase 1 Master MVP (v1.0)

Astra is an Advanced Smart Task & Research Assistant. This represents **Phase 1 Master MVP** — a highly polished, production-quality AI assistant platform featuring local SQLite database persistence, secure encrypted user settings, robust JWT authentication, drag-and-drop file uploading with full text extraction, and real-time response streaming (Server-Sent Events).

---

## 🛠️ Technology Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router, Framer Motion, Lucide Icons, React Markdown
- **Backend**: Express.js, TypeScript (`tsx` runner), Node.js Crypto, Multer (file uploads)
- **Database**: SQLite3 (native Promise wrapper, zero native-module compile issues)
- **AI Integrations**: Server-Side `@google/genai` (out-of-the-box fallback) and OpenAI-compatible Completions API

---

## 📂 Core Feature Matrix

1. **User Authentication**: Secure SignUp, LogIn, LogOut, password hashing (`bcryptjs`), and JWT-based session protection.
2. **Dashboard**: High-fidelity bento-grid stats summary, quick shortcut selectors, real-time system check, and recent sessions log.
3. **Chat Interface**: Clean chat history bubble streams, markdown renderings, inline code block highlightings, new chat trigger buttons, and history sidebar search/archive/pin.
4. **SSE Streaming**: Chunk-by-chunk real-time server streaming via Server-Sent Events (using modern `ReadableStream` reader clients).
5. **Session Memory**: Context-rich multi-turn histories are automatically fed back to completions for consistent local context retention.
6. **File Upload & Extraction**:
   - `.txt`: standard UTF-8 stream read.
   - `.pdf`: parsed via `pdf-parse` into clean context strings.
   - `.docx`: parsed via `mammoth` into clean context strings.
   - Extracted contexts are automatically appended to subsequent user turn queries as contextual reference documents.
7. **Security**: Multi-layer AES-256-CBC user key encryption at rest, secure JWT tokens, and automated sanitization of client endpoints.

---

## ⚡ Setup & Run Instructions

Since Astra is implemented as a single unified full-stack application (combining Express and Vite middleware in a single process), starting the app is extremely simple!

### 1. Configure Environment Variables
Copy `.env.example` to `.env` and fill out the parameters:
```bash
cp .env.example .env
```
Key variables:
- `JWT_SECRET_KEY`: A secure key used to sign JWT authorization tokens.
- `FERNET_KEY`: A secret password used to encrypt/decrypt user-configured API keys. Needs to be a secure string.
- `DEFAULT_OPENAI_BASE_URL`: Defaults to `https://api.openai.com/v1` for OpenAI completions.

To generate a secure 32-byte key for `FERNET_KEY` or `JWT_SECRET_KEY` in your terminal, run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Install Dependencies
Install all packages defined in `package.json`:
```bash
npm install
```

### 3. Run the Development Server
Starts the Express server on port `3000` with hot-reloading Vite middleware injected:
```bash
npm run dev
```

### 4. Build & Start in Production Mode
Compile the Vite static assets and bundle the Express typescript server to static outputs inside the `dist/` folder:
```bash
npm run build
npm start
```

---

## ⚙️ Where to Configure API Keys

Astra supports two tiers of AI models:
1. **System Default (No Configuration Required)**: Out-of-the-box, Astra connects directly to Gemini 3.5 Flash using the container's environment key. You can start chatting immediately!
2. **Personal OpenAI Key**: Navigate to **Settings** from the sidebar, input your OpenAI-compatible API key, and save. The key will be encrypted at rest immediately.

---

## 🔍 Troubleshooting Notes
- **Vite Failed to Connect to WebSocket**: Benign warning. This is expected inside sandbox preview environments (due to disabled HMR) and can be safely ignored.
- **Database Locking Error**: Ensure you have correct read/write permissions in the root directory. Astra will automatically create `astra.db` on startup.
- **Extraction Failures**: If PDF or DOCX text extraction fails, Astra will gracefully log the event, fallback to standard attachment mode, and alert the user in the input prompt.
