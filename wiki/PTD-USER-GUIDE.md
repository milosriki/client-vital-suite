# 🤖 PTD SUPERINTELLIGENCE - USER GUIDE

## 🚀 Getting Started

### 1. Access the Dashboard
Navigate to **[http://localhost:5173/ultimate-ceo](http://localhost:5173/ultimate-ceo)** (or click "AI CEO" in the navigation bar).

### 2. The "Ask Anything" Command Bar
The central input box is your direct line to the AI CEO. It intelligently routes your request to the best persona.

**Try these commands:**

*   **Strategic Analysis (Atlas)**:
    *   "Analyze our current churn rate and propose a strategy to reduce it by 10%."
    *   "What is the revenue impact of increasing our package prices by 5%?"

*   **Forensic Investigation (Sherlock)**:
    *   "Why did client Ahmed Al-Maktoum churn last month?"
    *   "Find patterns in leads that fail to convert."

*   **Revenue Opportunities (Revenue)**:
    *   "Identify clients ready for an upsell."
    *   "Find all failed payments from last week and draft recovery emails."

*   **Lead Optimization (Hunter)**:
    *   "Draft a follow-up email for leads who ghosted after the consultation."
    *   "Analyze the conversion rate of the 'Summer Body' campaign."

*   **Client Retention (Guardian)**:
    *   "Who are the top 5 clients at risk of leaving?"
    *   "Create a save plan for Sarah Jones."

### 3. Reviewing & Approving Actions
The AI **never** executes high-risk actions without your permission.

1.  **Pending Actions**: Appear in the "Pending Approvals" list.
2.  **Review**: Click "Review" to see the details (code diffs, email drafts, SQL queries).
3.  **Approve/Reject**:
    *   **Approve**: The system executes the action (deploys code, sends email, updates DB).
    *   **Reject**: You MUST provide a reason. The AI learns from this feedback to improve future suggestions.

### 4. Proactive Insights
The system runs in the background (every 15 mins) to find risks and opportunities. These appear as "Insights" or "Pending Actions" automatically.

---

## 🛠️ System Maintenance

### Monitoring
*   **Deployment Status**: Check the "Recent Executions" tab to see if code deployments succeeded.
*   **Learning**: The "Business Calibration" table grows as you use the system, making the AI smarter.

### Troubleshooting
*   **"Deployment Failed"**: Check the GitHub Actions tab in your repository for logs.
*   **"AI Hallucinating"**: Reject the action with specific feedback (e.g., "This data is wrong, check table X").
*   **"No Response"**: Ensure Edge Functions are deployed and secrets are set.

---

## 🔐 Security & Safety
*   **Code Safety**: All code goes through TypeScript validation and build tests before deployment.
*   **Data Safety**: The AI cannot delete data without explicit SQL approval.
*   **Human-in-the-Loop**: You are the final gatekeeper.
