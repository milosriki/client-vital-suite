/**
 * AGENT 4: Bug & Error Finder
 *
 * Scans the codebase to identify bugs, errors, potential issues,
 * anti-patterns, and code smells in the Client Vital Suite project
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface Bug {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  file: string;
  line?: number;
  description: string;
  codeSnippet?: string;
  fix?: string;
  impact: string;
}

interface BugReport {
  projectName: string;
  totalBugs: number;
  criticalBugs: number;
  highBugs: number;
  mediumBugs: number;
  lowBugs: number;
  bugs: Bug[];
  summary: string;
}

class BugErrorFinder {
  private projectRoot: string;
  private bugs: Bug[] = [];

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  async analyze(): Promise<BugReport> {
    this.bugs = [];

    await this.scanForCommonIssues();
    await this.scanForSecurityIssues();
    await this.scanForPerformanceIssues();
    await this.scanForAccessibilityIssues();

    const counts = this.categorize Bugs();

    return {
      projectName: 'client-vital-suite',
      totalBugs: this.bugs.length,
      criticalBugs: counts.critical,
      highBugs: counts.high,
      mediumBugs: counts.medium,
      lowBugs: counts.low,
      bugs: this.bugs,
      summary: this.generateSummary(counts),
    };
  }

  private async scanForCommonIssues(): Promise<void> {
    const srcPath = path.join(this.projectRoot, 'src');

    // Check for console.log statements
    const files = await glob('**/*.{ts,tsx}', { cwd: srcPath });

    for (const file of files) {
      const filePath = path.join(srcPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // Check for console.log
        if (line.includes('console.log') && !line.trim().startsWith('//')) {
          this.bugs.push({
            id: `CONSOLE-${Date.now()}-${index}`,
            severity: 'low',
            category: 'Code Quality',
            file: file,
            line: index + 1,
            description: 'console.log found in production code',
            codeSnippet: line.trim(),
            fix: 'Remove or replace with proper logging',
            impact: 'Performance and security concern',
          });
        }

        // Check for TODO/FIXME comments
        if (line.includes('TODO') || line.includes('FIXME')) {
          this.bugs.push({
            id: `TODO-${Date.now()}-${index}`,
            severity: 'low',
            category: 'Incomplete Code',
            file: file,
            line: index + 1,
            description: 'TODO/FIXME comment found',
            codeSnippet: line.trim(),
            fix: 'Complete the pending task',
            impact: 'Feature incomplete or needs attention',
          });
        }

        // Check for any/unknown types
        if (line.includes(': any') && !line.trim().startsWith('//')) {
          this.bugs.push({
            id: `ANY-${Date.now()}-${index}`,
            severity: 'medium',
            category: 'Type Safety',
            file: file,
            line: index + 1,
            description: 'Using "any" type defeats TypeScript safety',
            codeSnippet: line.trim(),
            fix: 'Replace with proper type definition',
            impact: 'Type safety compromised',
          });
        }
      });
    }
  }

  private async scanForSecurityIssues(): Promise<void> {
    // Check for hardcoded secrets
    const srcPath = path.join(this.projectRoot, 'src');
    const files = await glob('**/*.{ts,tsx}', { cwd: srcPath });

    for (const file of files) {
      const filePath = path.join(srcPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check for potential API keys
      if (content.match(/api[_-]?key\s*=\s*['"][^'"]+['"]/i)) {
        this.bugs.push({
          id: `SEC-APIKEY-${Date.now()}`,
          severity: 'critical',
          category: 'Security',
          file: file,
          description: 'Potential hardcoded API key found',
          fix: 'Move to environment variables',
          impact: 'Security vulnerability - credentials exposed',
        });
      }

      // Check for dangerouslySetInnerHTML
      if (content.includes('dangerouslySetInnerHTML')) {
        this.bugs.push({
          id: `SEC-XSS-${Date.now()}`,
          severity: 'high',
          category: 'Security',
          file: file,
          description: 'Using dangerouslySetInnerHTML (XSS risk)',
          fix: 'Sanitize input or use safe alternatives',
          impact: 'Potential XSS vulnerability',
        });
      }
    }

    // Check .env file
    const envPath = path.join(this.projectRoot, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      if (envContent.includes('PLACEHOLDER') || envContent.includes('your_')) {
        this.bugs.push({
          id: `ENV-PLACEHOLDER`,
          severity: 'high',
          category: 'Configuration',
          file: '.env',
          description: 'Placeholder values in .env file',
          fix: 'Replace with actual credentials',
          impact: 'App may not function correctly',
        });
      }
    }
  }

  private async scanForPerformanceIssues(): Promise<void> {
    const srcPath = path.join(this.projectRoot, 'src');
    const files = await glob('**/*.{ts,tsx}', { cwd: srcPath });

    for (const file of files) {
      const filePath = path.join(srcPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check for missing React.memo or useMemo
      if (file.endsWith('.tsx') && content.includes('export') && content.includes('function')) {
        if (!content.includes('memo') && content.length > 2000) {
          this.bugs.push({
            id: `PERF-MEMO-${file}`,
            severity: 'low',
            category: 'Performance',
            file: file,
            description: 'Large component without memoization',
            fix: 'Consider using React.memo for optimization',
            impact: 'Potential unnecessary re-renders',
          });
        }
      }

      // Check for inline function definitions in JSX
      const inlineFunctionMatches = content.match(/onClick=\{(\(\)|function)/g);
      if (inlineFunctionMatches && inlineFunctionMatches.length > 3) {
        this.bugs.push({
          id: `PERF-INLINE-${file}`,
          severity: 'low',
          category: 'Performance',
          file: file,
          description: 'Multiple inline function definitions in JSX',
          fix: 'Extract to useCallback or component-level functions',
          impact: 'Creates new function instances on each render',
        });
      }
    }
  }

  private async scanForAccessibilityIssues(): Promise<void> {
    const srcPath = path.join(this.projectRoot, 'src');
    const files = await glob('**/*.{tsx}', { cwd: srcPath });

    for (const file of files) {
      const filePath = path.join(srcPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check for images without alt text
      if (content.match(/<img[^>]*(?!alt=)/)) {
        this.bugs.push({
          id: `A11Y-IMG-${file}`,
          severity: 'medium',
          category: 'Accessibility',
          file: file,
          description: 'Image without alt attribute',
          fix: 'Add descriptive alt text',
          impact: 'Screen readers cannot describe image',
        });
      }

      // Check for buttons without aria-label
      if (content.includes('<button') && content.includes('Icon')) {
        if (!content.includes('aria-label')) {
          this.bugs.push({
            id: `A11Y-BTN-${file}`,
            severity: 'low',
            category: 'Accessibility',
            file: file,
            description: 'Icon button without aria-label',
            fix: 'Add aria-label for screen readers',
            impact: 'Button purpose unclear to assistive technologies',
          });
        }
      }
    }
  }

  private categorizeBugs() {
    return {
      critical: this.bugs.filter((b) => b.severity === 'critical').length,
      high: this.bugs.filter((b) => b.severity === 'high').length,
      medium: this.bugs.filter((b) => b.severity === 'medium').length,
      low: this.bugs.filter((b) => b.severity === 'low').length,
    };
  }

  private generateSummary(counts: ReturnType<typeof this.categorizeBugs>): string {
    if (counts.critical > 0) {
      return `CRITICAL: Found ${counts.critical} critical bugs that need immediate attention!`;
    } else if (counts.high > 0) {
      return `Found ${counts.high} high-priority bugs that should be fixed soon.`;
    } else if (counts.medium > 0) {
      return `Found ${counts.medium} medium-priority issues to address.`;
    } else if (counts.low > 0) {
      return `Found ${counts.low} low-priority improvements.`;
    } else {
      return 'No significant bugs found! Clean codebase.';
    }
  }

  async generateReport(): Promise<void> {
    console.log('\n🔍 Scanning codebase for bugs and errors...\n');

    const report = await this.analyze();

    console.log('\n===========================================');
    console.log('      BUG & ERROR FINDER REPORT');
    console.log('===========================================\n');

    console.log(`Project: ${report.projectName}`);
    console.log(`Total Issues: ${report.totalBugs}`);
    console.log(`  🔴 Critical: ${report.criticalBugs}`);
    console.log(`  🟠 High: ${report.highBugs}`);
    console.log(`  🟡 Medium: ${report.mediumBugs}`);
    console.log(`  🟢 Low: ${report.lowBugs}`);
    console.log(`\nSummary: ${report.summary}\n`);

    // Group by severity
    ['critical', 'high', 'medium', 'low'].forEach((severity) => {
      const bugs = report.bugs.filter((b) => b.severity === severity);
      if (bugs.length > 0) {
        console.log(`\n${severity.toUpperCase()} Issues (${bugs.length}):`);
        bugs.forEach((bug, index) => {
          console.log(`  ${index + 1}. [${bug.category}] ${bug.description}`);
          console.log(`     File: ${bug.file}${bug.line ? `:${bug.line}` : ''}`);
          console.log(`     Impact: ${bug.impact}`);
          if (bug.fix) console.log(`     Fix: ${bug.fix}`);
        });
      }
    });

    console.log('\n===========================================\n');
  }
}

// Run if executed directly
if (require.main === module) {
  const finder = new BugErrorFinder();
  finder.generateReport().catch(console.error);
}

export default BugErrorFinder;
