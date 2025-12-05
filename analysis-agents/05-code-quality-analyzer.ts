/**
 * AGENT 5: Code Quality Analyzer
 *
 * Analyzes code quality metrics, patterns, maintainability,
 * and overall code health of the Client Vital Suite project
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface FileMetrics {
  path: string;
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  complexity: number;
  imports: number;
  exports: number;
}

interface QualityMetrics {
  totalFiles: number;
  totalLines: number;
  averageLinesPerFile: number;
  commentRatio: number;
  largestFile: string;
  largestFileLines: number;
  complexityScore: number;
  maintainabilityIndex: number;
  qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

interface CodeQualityReport {
  projectName: string;
  metrics: QualityMetrics;
  fileMetrics: FileMetrics[];
  recommendations: string[];
}

class CodeQualityAnalyzer {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  async analyze(): Promise<CodeQualityReport> {
    const fileMetrics = await this.analyzeFiles();
    const metrics = this.calculateMetrics(fileMetrics);

    return {
      projectName: 'client-vital-suite',
      metrics,
      fileMetrics,
      recommendations: this.generateRecommendations(metrics, fileMetrics),
    };
  }

  private async analyzeFiles(): Promise<FileMetrics[]> {
    const srcPath = path.join(this.projectRoot, 'src');
    const files = await glob('**/*.{ts,tsx}', { cwd: srcPath });

    const fileMetrics: FileMetrics[] = [];

    for (const file of files) {
      const filePath = path.join(srcPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      let codeLines = 0;
      let commentLines = 0;
      let blankLines = 0;
      let imports = 0;
      let exports = 0;

      lines.forEach((line) => {
        const trimmed = line.trim();

        if (trimmed === '') {
          blankLines++;
        } else if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          commentLines++;
        } else {
          codeLines++;
        }

        if (trimmed.startsWith('import ')) imports++;
        if (trimmed.startsWith('export ')) exports++;
      });

      const complexity = this.calculateComplexity(content);

      fileMetrics.push({
        path: file,
        lines: lines.length,
        codeLines,
        commentLines,
        blankLines,
        complexity,
        imports,
        exports,
      });
    }

    return fileMetrics;
  }

  private calculateComplexity(content: string): number {
    let complexity = 1; // Base complexity

    // Count decision points
    const patterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?\s*.*\s*:/g, // Ternary operator
    ];

    patterns.forEach((pattern) => {
      const matches = content.match(pattern);
      if (matches) complexity += matches.length;
    });

    return complexity;
  }

  private calculateMetrics(fileMetrics: FileMetrics[]): QualityMetrics {
    const totalFiles = fileMetrics.length;
    const totalLines = fileMetrics.reduce((sum, f) => sum + f.lines, 0);
    const totalCodeLines = fileMetrics.reduce((sum, f) => sum + f.codeLines, 0);
    const totalCommentLines = fileMetrics.reduce((sum, f) => sum + f.commentLines, 0);
    const totalComplexity = fileMetrics.reduce((sum, f) => sum + f.complexity, 0);

    const averageLinesPerFile = Math.round(totalLines / totalFiles);
    const commentRatio = Number(((totalCommentLines / totalCodeLines) * 100).toFixed(2));
    const complexityScore = Math.round(totalComplexity / totalFiles);

    const largestFile = fileMetrics.reduce((max, file) =>
      file.lines > max.lines ? file : max
    );

    // Maintainability Index (simplified version)
    // MI = 171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC)
    // Simplified: Based on avg file size, complexity, and comment ratio
    const maintainabilityIndex = Math.max(
      0,
      Math.min(
        100,
        100 - averageLinesPerFile / 10 - complexityScore + commentRatio
      )
    );

    const qualityGrade = this.getQualityGrade(maintainabilityIndex);

    return {
      totalFiles,
      totalLines,
      averageLinesPerFile,
      commentRatio,
      largestFile: largestFile.path,
      largestFileLines: largestFile.lines,
      complexityScore,
      maintainabilityIndex: Math.round(maintainabilityIndex),
      qualityGrade,
    };
  }

  private getQualityGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  private generateRecommendations(
    metrics: QualityMetrics,
    fileMetrics: FileMetrics[]
  ): string[] {
    const recommendations: string[] = [];

    // File size recommendations
    if (metrics.averageLinesPerFile > 300) {
      recommendations.push(
        `Average file size (${metrics.averageLinesPerFile} lines) is large. Consider splitting into smaller modules.`
      );
    }

    // Largest file
    if (metrics.largestFileLines > 500) {
      recommendations.push(
        `Largest file (${metrics.largestFile}) has ${metrics.largestFileLines} lines. Consider refactoring.`
      );
    }

    // Comment ratio
    if (metrics.commentRatio < 10) {
      recommendations.push(
        `Comment ratio is ${metrics.commentRatio}%. Add more documentation comments (aim for 15-20%).`
      );
    }

    // Complexity
    if (metrics.complexityScore > 20) {
      recommendations.push(
        `Average complexity score is ${metrics.complexityScore}. Simplify complex functions.`
      );
    }

    // High complexity files
    const highComplexityFiles = fileMetrics.filter((f) => f.complexity > 30);
    if (highComplexityFiles.length > 0) {
      recommendations.push(
        `${highComplexityFiles.length} files have high complexity (>30). Refactor: ${highComplexityFiles
          .slice(0, 3)
          .map((f) => f.path)
          .join(', ')}`
      );
    }

    // Maintainability
    if (metrics.maintainabilityIndex < 60) {
      recommendations.push(
        'Maintainability index is below 60. Focus on reducing file sizes and complexity.'
      );
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Code quality is good! Continue following best practices.');
    }

    return recommendations;
  }

  async generateReport(): Promise<void> {
    console.log('\n📊 Analyzing code quality...\n');

    const report = await this.analyze();

    console.log('\n===========================================');
    console.log('     CODE QUALITY ANALYSIS REPORT');
    console.log('===========================================\n');

    console.log(`Project: ${report.projectName}`);
    console.log(`Quality Grade: ${report.metrics.qualityGrade}`);
    console.log(`Maintainability Index: ${report.metrics.maintainabilityIndex}/100\n`);

    console.log('CODE METRICS:');
    console.log(`  Total Files: ${report.metrics.totalFiles}`);
    console.log(`  Total Lines: ${report.metrics.totalLines.toLocaleString()}`);
    console.log(`  Average Lines/File: ${report.metrics.averageLinesPerFile}`);
    console.log(`  Comment Ratio: ${report.metrics.commentRatio}%`);
    console.log(`  Complexity Score: ${report.metrics.complexityScore}/file`);
    console.log(`  Largest File: ${report.metrics.largestFile} (${report.metrics.largestFileLines} lines)\n`);

    console.log('RECOMMENDATIONS:');
    report.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });

    console.log('\nTOP 5 LARGEST FILES:');
    report.fileMetrics
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 5)
      .forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.path} (${file.lines} lines, complexity: ${file.complexity})`);
      });

    console.log('\nTOP 5 MOST COMPLEX FILES:');
    report.fileMetrics
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 5)
      .forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.path} (complexity: ${file.complexity})`);
      });

    console.log('\n===========================================\n');
  }
}

// Run if executed directly
if (require.main === module) {
  const analyzer = new CodeQualityAnalyzer();
  analyzer.generateReport().catch(console.error);
}

export default CodeQualityAnalyzer;
