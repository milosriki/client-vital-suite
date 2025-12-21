# Lovable.dev Build Prompt for PTD Fitness AI Dev Console

I need you to build a "Self-Developing AI Command Center" for my PTD Fitness application. This will be the interface where I control my autonomous coding agents.

## Core Features Needed:

1. **Command Interface**
   - A prominent text area to give natural language instructions (e.g., "Build a lead response tracker")
   - A "Execute" button that triggers the `ptd-self-developer` Supabase Edge Function
   - Quick-action chips for common tasks (e.g., "Check Health Scores", "Analyze Churn")

2. **Action Dashboard (Tabs)**
   - **Pending Approval**: List of code changes the AI has prepared. Each card should show:
     - Title & Description
     - Risk Level (Low/Medium/High) with color coding
     - Confidence Score (%)
     - Number of files changed
     - "Preview" and "Approve" buttons
   - **Executing**: Real-time status of deployments (using GitHub Actions)
   - **History**: Log of past actions (Executed/Rejected)

3. **Code Preview Modal**
   - When clicking "Preview", open a dialog showing:
     - The AI's reasoning (Why it built this)
     - File diffs or full file content (syntax highlighted)
     - Database migration SQL (if any)
   - "Reject" button (with reason input)
   - "Approve & Deploy" button

4. **Tech Stack Integration**
   - Use `lucide-react` for icons (Bot, Code, Rocket, Shield)
   - Use `shadcn/ui` components (Card, Button, Badge, Dialog, Tabs)
   - Use `supabase-js` to fetch from `prepared_actions` table
   - Use `react-query` for real-time updates

## Data Structure (Supabase)
Table: `prepared_actions`
- `id`: uuid
- `action_title`: text
- `action_description`: text
- `risk_level`: 'low' | 'medium' | 'high'
- `status`: 'pending' | 'executing' | 'executed' | 'rejected'
- `prepared_payload`: jsonb (contains `{ files: [{ path, content }] }`)

## Design Aesthetic
- Dark mode, futuristic "Command Center" vibe
- Glassmorphism effects
- Green/Purple gradients for AI elements
- Monospace fonts for code snippets

Please generate the React code for this page (`AIDevConsole.tsx`) and the necessary Supabase integration hooks.
