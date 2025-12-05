# Client Vital Suite - Analysis Agents

5 specialized analysis agents to evaluate the Client Vital Suite codebase built with Lovable.

## 🤖 Agents Overview

| # | Agent | File | Purpose |
|---|-------|------|---------|
| **1** | **Technology Analyzer** | `01-technology-analyzer.ts` | Analyzes all technologies, frameworks, and libraries used |
| **2** | **Pros & Cons Analyzer** | `02-pros-cons-analyzer.ts` | Evaluates strengths and weaknesses of the codebase |
| **3** | **Idea & Concept Analyzer** | `03-idea-concept-analyzer.ts` | Analyzes the business idea, target market, and product vision |
| **4** | **Bug & Error Finder** | `04-bug-error-finder.ts` | Scans for bugs, errors, security issues, and anti-patterns |
| **5** | **Code Quality Analyzer** | `05-code-quality-analyzer.ts` | Analyzes code quality metrics and maintainability |

## 📦 Installation

Make sure you have the required dependencies:

```bash
npm install
# or
bun install
```

## 🚀 Usage

### Run All Agents at Once

```bash
npx tsx analysis-agents/run-all-agents.ts
```

### Run Individual Agents

```bash
# Technology Stack Analysis
npx tsx analysis-agents/01-technology-analyzer.ts

# Pros & Cons Analysis
npx tsx analysis-agents/02-pros-cons-analyzer.ts

# Idea & Concept Analysis
npx tsx analysis-agents/03-idea-concept-analyzer.ts

# Bug & Error Finding
npx tsx analysis-agents/04-bug-error-finder.ts

# Code Quality Analysis
npx tsx analysis-agents/05-code-quality-analyzer.ts
```

## 📊 What Each Agent Does

### 1️⃣ Technology Analyzer
- Lists all dependencies (production + dev)
- Categorizes by purpose (frontend, backend, database, tools)
- Identifies framework stack
- Shows version numbers

### 2️⃣ Pros & Cons Analyzer
- Evaluates code architecture
- Identifies strengths and weaknesses
- Provides impact ratings (high/medium/low)
- Gives actionable recommendations
- Calculates overall codebase score (0-100)

### 3️⃣ Idea & Concept Analyzer
- Analyzes business concept and value proposition
- Identifies target audience
- Lists implemented features
- Assesses market fit
- Provides growth recommendations

### 4️⃣ Bug & Error Finder
- Scans for common coding issues
- Detects security vulnerabilities
- Finds performance bottlenecks
- Checks accessibility problems
- Categorizes by severity (critical/high/medium/low)
- Provides fixes for each issue

### 5️⃣ Code Quality Analyzer
- Calculates code metrics (lines, comments, complexity)
- Measures maintainability index
- Assigns quality grade (A-F)
- Identifies largest/most complex files
- Provides improvement recommendations

## 📈 Sample Output

```
╔═══════════════════════════════════════════╗
║  CLIENT VITAL SUITE - ANALYSIS SUITE     ║
║        Running All 5 Agents...           ║
╚═══════════════════════════════════════════╝

🔧 [1/5] Running Technology Analyzer...
===========================================
   TECHNOLOGY STACK ANALYSIS REPORT
===========================================

Project: client-vital-suite
Total Dependencies: 45

Framework Stack:
  - React
  - Vite
  - TypeScript
  - Tailwind CSS
  - Supabase

...

╔═══════════════════════════════════════════╗
║          ANALYSIS COMPLETE ✅            ║
║      Completed in 2.45 seconds            ║
╚═══════════════════════════════════════════╝
```

## 🎯 When to Use

Run these agents:
- ✅ Before major releases
- ✅ During code reviews
- ✅ When evaluating technical debt
- ✅ To identify improvement areas
- ✅ For documentation purposes
- ✅ When onboarding new developers

## 🔧 Customization

Each agent is a standalone TypeScript class. You can:
- Import and use in your own scripts
- Extend with custom analysis logic
- Integrate into CI/CD pipelines
- Export reports to JSON/HTML

Example:
```typescript
import TechnologyAnalyzer from './01-technology-analyzer';

const analyzer = new TechnologyAnalyzer();
const report = analyzer.analyze();
console.log(report);
```

## 📝 Notes

- Agents use static analysis (no code execution required)
- Safe to run on any codebase
- No external API calls
- Results are deterministic
- Designed for Lovable/React/TypeScript projects

## 🤝 Contributing

To add a new agent:
1. Create `06-your-analyzer.ts`
2. Follow the existing pattern (analyze + generateReport)
3. Add to `run-all-agents.ts`
4. Update this README

## 📄 License

Part of Client Vital Suite project
