/**
 * AGENT 1: Technology Stack Analyzer
 *
 * Analyzes all technologies used in the Client Vital Suite project
 * Identifies frameworks, libraries, tools, and their versions
 */

import fs from 'fs';
import path from 'path';

interface TechnologyInfo {
  name: string;
  version: string;
  category: string;
  purpose: string;
  isDevDependency: boolean;
}

interface TechnologyReport {
  projectName: string;
  totalDependencies: number;
  technologies: {
    frontend: TechnologyInfo[];
    backend: TechnologyInfo[];
    database: TechnologyInfo[];
    tools: TechnologyInfo[];
    testing: TechnologyInfo[];
  };
  frameworkStack: string[];
}

class TechnologyAnalyzer {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  analyze(): TechnologyReport {
    const packageJson = this.readPackageJson();
    const technologies = this.categorize Dependencies(packageJson);

    return {
      projectName: packageJson.name || 'client-vital-suite',
      totalDependencies:
        Object.keys(packageJson.dependencies || {}).length +
        Object.keys(packageJson.devDependencies || {}).length,
      technologies,
      frameworkStack: this.identifyFrameworkStack(packageJson),
    };
  }

  private readPackageJson(): any {
    const packagePath = path.join(this.projectRoot, 'package.json');
    return JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  }

  private categorizeDependencies(packageJson: any): TechnologyReport['technologies'] {
    const deps = packageJson.dependencies || {};
    const devDeps = packageJson.devDependencies || {};

    const categories = {
      frontend: [] as TechnologyInfo[],
      backend: [] as TechnologyInfo[],
      database: [] as TechnologyInfo[],
      tools: [] as TechnologyInfo[],
      testing: [] as TechnologyInfo[],
    };

    // Frontend
    const frontendLibs = ['react', 'react-dom', '@tanstack/react-query', 'react-router-dom'];
    frontendLibs.forEach((lib) => {
      if (deps[lib]) {
        categories.frontend.push({
          name: lib,
          version: deps[lib],
          category: 'Frontend',
          purpose: this.getPurpose(lib),
          isDevDependency: false,
        });
      }
    });

    // Backend
    const backendLibs = ['express', 'axios'];
    backendLibs.forEach((lib) => {
      if (deps[lib]) {
        categories.backend.push({
          name: lib,
          version: deps[lib],
          category: 'Backend',
          purpose: this.getPurpose(lib),
          isDevDependency: false,
        });
      }
    });

    // Database
    const dbLibs = ['@supabase/supabase-js'];
    dbLibs.forEach((lib) => {
      if (deps[lib]) {
        categories.database.push({
          name: lib,
          version: deps[lib],
          category: 'Database',
          purpose: this.getPurpose(lib),
          isDevDependency: false,
        });
      }
    });

    return categories;
  }

  private identifyFrameworkStack(packageJson: any): string[] {
    const stack: string[] = [];
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps['react']) stack.push('React');
    if (deps['vite']) stack.push('Vite');
    if (deps['typescript']) stack.push('TypeScript');
    if (deps['tailwindcss']) stack.push('Tailwind CSS');
    if (deps['@supabase/supabase-js']) stack.push('Supabase');

    return stack;
  }

  private getPurpose(lib: string): string {
    const purposes: Record<string, string> = {
      'react': 'UI library for building component-based interfaces',
      'react-dom': 'React rendering for web browsers',
      '@tanstack/react-query': 'Data fetching and state management',
      'react-router-dom': 'Client-side routing',
      '@supabase/supabase-js': 'Database and authentication',
      'tailwindcss': 'Utility-first CSS framework',
      'vite': 'Build tool and dev server',
      'typescript': 'Type-safe JavaScript',
    };
    return purposes[lib] || 'Utility library';
  }

  generateReport(): void {
    const report = this.analyze();

    console.log('\n===========================================');
    console.log('   TECHNOLOGY STACK ANALYSIS REPORT');
    console.log('===========================================\n');

    console.log(`Project: ${report.projectName}`);
    console.log(`Total Dependencies: ${report.totalDependencies}\n`);

    console.log('Framework Stack:');
    report.frameworkStack.forEach((framework) => {
      console.log(`  - ${framework}`);
    });

    console.log('\n===========================================\n');
  }
}

// Run if executed directly
if (require.main === module) {
  const analyzer = new TechnologyAnalyzer();
  analyzer.generateReport();
}

export default TechnologyAnalyzer;
