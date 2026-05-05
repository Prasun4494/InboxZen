# InboxZen 🚀

InboxZen is an intelligent, AI-powered email management and triage dashboard designed to conquer email overload. It leverages the Gmail API and Google Generative AI to automatically categorize your inbox, suggest auto-replies, intelligently clean up promotional/spam emails, and integrate directly with your Google Calendar.

## 🌟 Key Features

### 1. AI-Powered Email Triage
* **Smart Classification:** Automatically categorizes unread emails into priority buckets (`urgent_reply`, `read_later`, `delegate`, `meeting_request`, `spam`, `promotion`).
* **Auto-Reply Suggestions:** Generates context-aware, professional draft replies for urgent emails using Google's Gemini AI.
* **Kanban Workflow:** A beautiful drag-and-drop or click-based Kanban board to quickly process and triage unread emails.

### 2. Intelligent Cleanup Service
* **Promotions & Social Dashboard:** A dedicated view for managing promotional and social emails, keeping them out of your primary workflow.
* **Bulk Deletion & Trash:** Safely bulk-delete hundreds of emails with a single click. 
* **Undo Mechanism:** An intuitive toast notification allows you to instantly undo accidental bulk deletions.
* **Automated Scheduling:** Configurable background workers automatically clean up old promotions and spam based on your preferences.

### 3. Google Calendar Integration
* **Meeting Detection:** The AI automatically scans emails for meeting context and extracts the Date, Time, Location, and Participants.
* **Seamless Scheduling:** Add detected meetings directly to your Google Calendar with a single click from the Kanban board or Email Details view.
* **Calendar Dashboard:** View your upcoming schedule fetched directly from the Google Calendar API within the InboxZen dashboard.
* **Smart Mock Fallback:** If the Google Calendar API is not yet enabled in your GCP project, the dashboard gracefully falls back to mock data so the UI remains fully functional for demonstrations.

## 🛠️ Technology Stack

* **Frontend:** React, Vite, Tailwind CSS, Framer Motion (for smooth animations), Recharts (for analytics).
* **Backend:** Node.js, Express.js, Google APIs (Gmail & Calendar), Google Generative AI (Gemini).
* **Authentication:** Secure Google OAuth 2.0 with OTP verification.

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* A Google Cloud Platform (GCP) Account with **Gmail API** and **Google Calendar API** enabled.
* A Google Gemini API Key.

### Environment Setup
You will need to set up your `.env` files.

**Backend (`backend/.env`):**
```env
PORT=3000
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=your_gemini_api_key
```

### Installation & Running

1. **Install Dependencies:**
   Navigate to both the `frontend` and `backend` directories and run:
   ```bash
   npm install
   ```

2. **Start the Backend Server:**
   ```bash
   cd backend
   npm run dev
   ```

3. **Start the Frontend Application:**
   ```bash
   cd frontend
   npm run dev
   ```

4. **Access the Application:**
   Open your browser and navigate to `http://localhost:5173`. Click "Continue with Google" to authenticate and begin using InboxZen.

## 🔒 Security & Privacy
InboxZen operates locally and uses secure OAuth tokens. It features a custom OTP verification step during login for added security. Your emails are processed by Google's Gemini AI strictly for triage purposes and are not stored permanently by the InboxZen server.
