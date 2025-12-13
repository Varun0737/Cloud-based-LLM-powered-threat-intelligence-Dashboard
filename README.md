# Cloud-Based LLM-Powered Threat Intelligence Dashboard

A next-generation cybersecurity platform that aggregates, analyzes, and visualizes global threat data in real-time. By combining live CVE feeds with Large Language Model (LLM) intelligence, this dashboard empowers security analysts to move from *reactive* patching to *proactive* threat hunting.

---

## 🚀 Key Features & Why They Matter

### 1. **AI-Powered Threat Sentinel ("Sentinel")**
*   **What it is**: An integrated AI assistant (powered by OpenAI GPT-4o) that acts as a Tier 1 Security Analyst.
*   **Importance**: Instead of manually reading hundreds of reports, you can ask *"What are the latest critical SQL injection vulnerabilities?"* or *"Summarize the risk of CVE-2024-XYZ"*. The AI contextualizes raw data into actionable intelligence.

### 2. **Real-Time CVE Live Feed**
*   **What it is**: A ticker that polls national threat databases (NVD, CIRCL) every 60 seconds.
*   **Importance**: Zero-day vulnerabilities emerge constantly. The live feed ensures you see threats the moment they are disclosed, reducing the "Time to Detect" (TTD) gap.

### 3. **Advanced Visual Analytics**
*   **What it is**: A dedicated Visualization Dashboard (`/visuals`) featuring:
    *   **Severity Distribution**: Pie charts breaking down Critical vs. Low risks.
    *   **Trend Analysis**: Area charts showing vulnerability disclosure rates over time.
    *   **Top Targets**: Bar charts identifying the most attacked vendors (e.g., Microsoft, Google, Adobe).
*   **Importance**: Visuals turn rows of data into patterns. Recognizing that "Vendor X" is having a spike in vulnerabilities allows teams to prioritize hardening those specific systems.

### 4. **Global Threat Map**
*   **What it is**: An interactive 3D globe visualizing the geographical origin and target of cyber threats.
*   **Importance**: Provides situational awareness of the global threat landscape. Seeing a cluster of attacks from a specific region helps in geoblocking decisions and attribution analysis.

### 5. **Intelligent Search & Archive**
*   **What it is**: A full-text search engine powered by MongoDB Text Indexes, capable of filtering thousands of stored CVEs by keyword, vendor, or severity.
*   **Importance**: Essential for historical analysis and compliance audits. Quickly find every vulnerability related to your specific tech stack (e.g., "Apache Struts").

### 6. **Automated Security News Scraper**
*   **What it is**: A background service that scrapes top security news sites (The Hacker News, BleepingComputer) and feeds headlines into the dashboard.
*   **Importance**: CVEs are only half the story. News gives context on *active exploitation*, ransomware campaigns, and industry trends that haven't been assigned a CVE ID yet.

---

## 🛠️ Technology Stack

*   **Frontend**: React (Vite), TailwindCSS, Framer Motion, Plotly.js (Data Viz).
*   **Backend**: Node.js (Express), Puppeteer (Scraping), OpenAI API.
*   **Database**: MongoDB (Data persistence & Text Search).
*   **Design**: "Cyber-Neon" aesthetic for high-contrast, low-eye-strain monitoring in SOC environments.

## 🔒 Security Hardening (Prototype)

*   **Helmet Headers**: Protects against common web vulnerabilities (XSS, Clickjacking).
*   **Rate Limiting**: Prevents API abuse and DoS attempts.
*   **JWT Authentication**: Secure, session-less access control for API endpoints.
*   **CORS Policies**: Strict allow-lists to prevent unauthorized cross-origin requests.

## 📦 Setup & Installation

### Prerequisites
*   Node.js v18+
*   MongoDB (Local or Atlas)
*   OpenAI API Key (for AI features)

### Quick Start

1.  **Clone the Repo**
    ```bash
    git clone https://github.com/Varun0737/Cloud-based-LLM-powered-threat-intelligence-Dashboard.git
    cd Cloud-based-LLM-powered-threat-intelligence-Dashboard
    ```

2.  **Environment Setup**
    Create `.env` in `api-server/` with:
    ```env
    MONGO_URI=mongodb://localhost:27017/threat-db
    OPENAI_API_KEY=sk-your-key-here
    JWT_SECRET=your_secret_key
    ```

3.  **Install Dependencies**
    ```bash
    cd api-server && npm install
    cd ../frontend && npm install
    ```

4.  **Run the Application**
    *   **Backend**: `cd api-server && npm start`
    *   **Frontend**: `cd frontend && npm run dev`

5.  **Access**: Navigate to `http://localhost:5173`

---

## 🔮 Future Roadmap
*   **Proprietary LLM Hosting**: Replace OpenAI with a self-hosted Llama 3 model for air-gapped security.
*   **SIEM Integration**: Forward alerts to Splunk or Elastic.
*   **Automated Patching**: Generate Ansible scripts to fix detected CVEs automatically.

