#!/usr/bin/env npx tsx

/**
 * CLIENT VITAL SUITE - ANALYSIS AGENTS RUNNER
 *
 * Runs all 5 analysis agents and generates a comprehensive report
 *
 * Usage: npx tsx analysis-agents/run-all-agents.ts
 */

import TechnologyAnalyzer from './01-technology-analyzer';
import ProsConsAnalyzer from './02-pros-cons-analyzer';
import IdeaConceptAnalyzer from './03-idea-concept-analyzer';
import BugErrorFinder from './04-bug-error-finder';
import CodeQualityAnalyzer from './05-code-quality-analyzer';

async function runAllAgents() {
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  CLIENT VITAL SUITE - ANALYSIS SUITE  ║');
  console.log('║        Running All 5 Agents...           ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  const startTime = Date.now();

  try {
    // Agent 1: Technology Stack
    console.log('\n🔧 [1/5] Running Technology Analyzer...');
    const techAnalyzer = new TechnologyAnalyzer();
    techAnalyzer.generateReport();

    // Agent 2: Pros & Cons
    console.log('\n⚖️  [2/5] Running Pros & Cons Analyzer...');
    const prosConsAnalyzer = new ProsConsAnalyzer();
    await prosConsAnalyzer.generateReport();

    // Agent 3: Idea & Concept
    console.log('\n💡 [3/5] Running Idea & Concept Analyzer...');
    const ideaAnalyzer = new IdeaConceptAnalyzer();
    ideaAnalyzer.generateReport();

    // Agent 4: Bug & Error Finder
    console.log('\n🐛 [4/5] Running Bug & Error Finder...');
    const bugFinder = new BugErrorFinder();
    await bugFinder.generateReport();

    // Agent 5: Code Quality
    console.log('\n📊 [5/5] Running Code Quality Analyzer...');
    const qualityAnalyzer = new CodeQualityAnalyzer();
    await qualityAnalyzer.generateReport();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║          ANALYSIS COMPLETE ✅            ║');
    console.log(`║      Completed in ${duration} seconds             ║`);
    console.log('╚═══════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n❌ Error running agents:', error);
    process.exit(1);
  }
}

// Run all agents
runAllAgents();
