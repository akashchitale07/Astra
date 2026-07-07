# Astra Local Companion Agent (Phase 4 Computer Control)

Welcome to the Astra Local Companion Agent! This agent bridges your web browser's secure sandbox to your local machine, allowing Astra to securely open/close applications, perform file operations, capture screen snapshots, and trigger automation.

---

## 🔒 Security Architecture (Guard Rails)

1. **Localhost Only binding**: The server binds exclusively to `127.0.0.1`. It is mathematically impossible for external network requests to reach it.
2. **Malicious origin rejection**: The agent strictly validates and rejects requests from unauthorized browser domains (non-localhost, unauthorized origins).
3. **One-Time Pairing Token**: Encrypted storage using AES-256-CBC keeps tokens completely private. It generates a unique pairing code on first run that you must enter once in your Astra settings.
4. **Enforced Allowlists**: Directories (folders) and Applications must be registered in the allowlist. No action can touch folders or files outside these approved paths.
5. **Global Safety Lockout (Kill Switch)**: A prominent red banner in your web control allows you to instantly trigger a system-wide lock, blocking any computer command from executing.
6. **Detailed Audit Trail**: Both your local terminal and your database store cryptographically logged execution records (with redacted credentials).

---

## 🚀 Getting Started

### 1. Install Node.js
Ensure you have Node.js installed on your computer.

### 2. Install dependencies
Navigate to the `/agent` directory in your terminal:
```bash
cd agent
npm install
```

### 3. Start the Local Agent
Run the agent in development mode:
```bash
npm run dev
```

On first startup, the terminal will print a secure **Pairing Token**:
```text
-----------------------------------------
🆕 New pairing token generated for Astra!
🔑 PAIRING TOKEN: astra_abc123xyz789
⚠️ Copy this code and enter it in the Astra Web application.
-----------------------------------------
```

### 4. Connect in the Astra Web App
1. Open the Astra web interface.
2. Navigate to **Computer Control** from the sidebar menu.
3. Paste the **Pairing Token** and choose a friendly device name (e.g. "My Mac Studio").
4. Click **Establish Secure Pairing**.

---

## 🎛️ Sandbox Capabilities Supported

- **Browser Control**: Open secure website links directly.
- **Application Orchestration**: Open allowlisted binary files, close running processes, and list active programs.
- **File System Operations**: Create folders, rename/move/copy files, recursive text search, and deletion (restricted to approved directory paths).
- **Automation Simulations**: Keyboard typing simulation, mouse coordinate clicks, and clipboard reading/writing.
- **Terminal Integration**: Raw shell script run-modes (guarded by automatic safety blocklist of destructive command patterns).
