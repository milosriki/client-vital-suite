/**
 * AGENT 2: Pros & Cons Analyzer
 *
 * Evaluates the strengths and weaknesses of the Client Vital Suite codebase
 * Analyzes architecture, code patterns, scalability, and maintainability
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface AnalysisItem {
  category: string;
  finding: string;
  impact: 'high' | 'medium' | 'low';
  recommendation?: string;
}

interface ProsConsReport {
  projectName: string;
  overallScore: number;
  pros: AnalysisItem[];
  cons: AnalysisItem[];
  summary: string;
}

class ProsConsAnalyzer {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  async analyze(): Promise<ProsConsReport> {
    const pros = await this.analyzePros();
    const cons = await this.analyzeCons();
    const score = this.calculateOverallScore(pros, cons);

    return {
      projectName: 'client-vital-suite',
      overallScore: score,
      pros,
      cons,
      summary: this.generateSummary(score, pros, cons),
    };
  }

  private async analyzePros(): Promise<AnalysisItem[]> {
    const pros: AnalysisItem[] = [];

    // Check for TypeScript
    if (fs.existsSync(path.join(this.projectRoot, 'tsconfig.json'))) {
      pros.push({
        category: 'Type Safety',
        finding: 'Full TypeScript implementation',
        impact: 'high',
        recommendation: 'Continue leveraging TypeScript for type safety',
      });
    }

    // Check for modern tooling
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf-8')
    );

    if (packageJson.dependencies?.['@tanstack/react-query']) {
      pros.push({
        category: 'Data Management',
        finding: 'Using React Query for efficient data fetching',
        impact: 'high',
        recommendation: 'Great choice for server state management',
      });
    }

    if (packageJson.dependencies?.['react-router-dom']) {
      pros.push({
        category: 'Routing',
        finding: 'Client-side routing with React Router',
        impact: 'medium',
        recommendation: 'Well-established routing solution',
      });
    }

    // Check component structure
    const srcPath = path.join(this.projectRoot, 'src');
    if (fs.existsSync(path.join(srcPath, 'components'))) {
      pros.push({
        category: 'Code Organization',
        finding: 'Modular component architecture',
        impact: 'high',
      });
    }

    if (fs.existsSync(path.join(srcPath, 'hooks'))) {
      pros.push({
        category: 'Code Reusability',
        finding: 'Custom hooks for logic separation',
        impact: 'medium',
      });
    }

    return pros;
  }

  private async analyzeCons(): Promise<AnalysisItem[]> {
    const cons: AnalysisItem[] = [];

    // Check for missing tests
    const hasTests = fs.existsSync(path.join(this.projectRoot, '__tests__')) ||
      fs.existsSync(path.join(this.projectRoot, 'src/__tests__'));

    if (!hasTests) {
      cons.push({
        category: 'Testing',
        finding: 'No test suite detected',
        impact: 'high',
        recommendation: 'Add Jest/Vitest + React Testing Library',
      });
    }

    // Check for environment variable handling
    const hasEnvExample = fs.existsSync(path.join(this.projectRoot, '.env.example'));
    if (!hasEnvExample) {
      cons.push({
        category: 'Configuration',
        finding: 'Missing .env.example file',
        impact: 'medium',
        recommendation: 'Add .env.example for better developer onboarding',
      });
    }

    // Check for documentation
    const hasDetailedDocs = fs.existsSync(path.join(this.projectRoot, 'docs'));
    if (!hasDetailedDocs) {
      cons.push({
        category: 'Documentation',
        finding: 'Limited project documentation',
        impact: 'medium',
        recommendation: 'Add comprehensive documentation for features',
      });
    }

    return cons;
  }

  private calculateOverallScore(pros: AnalysisItem[], cons: AnalysisItem[]): number {
    const prosScore = pros.reduce((sum, item) => {
      return sum + (item.impact === 'high' ? 10 : item.impact === 'medium' ? 6 : 3);
    }, 0);

    const consScore = cons.reduce((sum, item) => {
      return sum + (item.impact === 'high' ? -10 : item.impact === 'medium' ? -6 : -3);
    }, 0);

    const baseScore = 50;
    const finalScore = Math.max(0, Math.min(100, baseScore + prosScore + consScore));

    return Math.round(finalScore);
  }

  private generateSummary(score: number, pros: AnalysisItem[], cons: AnalysisItem[]): string {
    if (score >= 80) {
      return `Excellent codebase with ${pros.length} strengths. Minor improvements needed.`;
    } else if (score >= 60) {
      return `Good codebase with ${pros.length} strengths and ${cons.length} areas for improvement.`;
    } else if (score >= 40) {
      return `Moderate codebase. Focus on addressing ${cons.length} identified issues.`;
    } else {
      return `Needs significant improvements. Prioritize critical issues.`;
    }
  }

  async generateReport(): Promise<void> {
    const report = await this.analyze();

    console.log('\n===========================================');
    console.log('     PROS & CONS ANALYSIS REPORT');
    console.log('===========================================\n');

    console.log(`Project: ${report.projectName}`);
    console.log(`Overall Score: ${report.overallScore}/100`);
    console.log(`Summary: ${report.summary}\n`);

    console.log('PROS (Strengths):');
    report.pros.forEach((pro, index) => {
      console.log(`  ${index + 1}. [${pro.impact.toUpperCase()}] ${pro.category}: ${pro.finding}`);
    });

    console.log('\nCONS (Weaknesses):');
    report.cons.forEach((con, index) => {
      console.log(`  ${index + 1}. [${con.impact.toUpperCase()}] ${con.category}: ${con.finding}`);
      if (con.recommendation) {
        console.log(`     → ${con.recommendation}`);
      }
    });

    console.log('\n===========================================\n');
  }
}

// Run if executed directly
if (require.main === module) {
  const analyzer = new ProsConsAnalyzer();
  analyzer.generateReport().catch(console.error);
}

export default ProsConsAnalyzer;
