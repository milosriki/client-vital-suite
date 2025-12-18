/**
 * Verification Script: No Mock Data
 *
 * This script verifies that the application has NO hardcoded or mock data.
 * It checks all key pages and components to ensure they only query from the database.
 */

import fs from 'fs';
import path from 'path';

interface CheckResult {
  file: string;
  passed: boolean;
  issues: string[];
}

const results: CheckResult[] = [];

// Patterns that indicate hardcoded/mock data
const MOCK_DATA_PATTERNS = [
  /const\s+\w*coaches\s*=\s*\[\s*\{/i,  // const coaches = [{...}] (hardcoded objects)
  /const\s+\w*MOCK_/i,                   // const MOCK_anything
  /const\s+\w*FAKE_/i,                   // const FAKE_anything
  /const\s+\w*TEST_/i,                   // const TEST_anything (except in test files)
  /@example\.com/,                        // @example.com (in strings, not comments)
  /@email\.com/,                          // @email.com (in strings, not comments)
  /@test\.com/,                           // @test.com (in strings, not comments)
  /id:\s*['"]123456['"]/,                // id: '123456'
  /email:\s*['"][^'"]*@example\.com['"]/,  // email: 'something@example.com'
];

// Files to check
const filesToCheck = [
  'src/pages/Coaches.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/Clients.tsx',
  'src/components/CoachCard.tsx',
  'src/components/ClientCard.tsx',
  'src/components/dashboard/KPIGrid.tsx',
  'src/components/dashboard/CoachLeaderboard.tsx',
];

function checkFile(filePath: string): CheckResult {
  const fullPath = path.join(process.cwd(), filePath);
  const result: CheckResult = {
    file: filePath,
    passed: true,
    issues: [],
  };

  try {
    const content = fs.readFileSync(fullPath, 'utf-8');

    // Remove comments to avoid false positives
    const codeWithoutComments = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
      .replace(/\/\/.*/g, '');          // Remove // comments

    // Check for mock data patterns
    MOCK_DATA_PATTERNS.forEach((pattern, index) => {
      if (pattern.test(codeWithoutComments)) {
        result.passed = false;
        result.issues.push(`Found potential mock data pattern: ${pattern.source}`);
      }
    });

    // Check that it uses proper database queries
    const hasSupabaseQuery = /supabase\s*\.\s*from\(/.test(content) ||
                            /useQuery/.test(content) ||
                            /queryFn/.test(content);

    const hasHardcodedArray = /const\s+\w+\s*=\s*\[\s*\{/.test(content);

    if (hasHardcodedArray && !hasSupabaseQuery && !filePath.includes('types') && !filePath.includes('utils')) {
      result.passed = false;
      result.issues.push('Found hardcoded array without database query');
    }

  } catch (error: unknown) {
    result.passed = false;
    result.issues.push(`Error reading file: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

// Run checks
console.log('🔍 Verifying No Mock/Hardcoded Data in Application\n');
console.log('=' .repeat(60));

filesToCheck.forEach((file) => {
  const result = checkFile(file);
  results.push(result);

  const status = result.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status} - ${file}`);

  if (!result.passed) {
    result.issues.forEach((issue) => {
      console.log(`  ⚠️  ${issue}`);
    });
  }
});

console.log('\n' + '='.repeat(60));

const allPassed = results.every((r) => r.passed);
const passedCount = results.filter((r) => r.passed).length;
const totalCount = results.length;

console.log(`\n📊 Results: ${passedCount}/${totalCount} files passed`);

if (allPassed) {
  console.log('\n✅ SUCCESS: No mock or hardcoded data found!');
  console.log('All files properly query from the database.\n');
  process.exit(0);
} else {
  console.log('\n❌ FAILURE: Mock or hardcoded data detected!');
  console.log('Please review and fix the issues above.\n');
  process.exit(1);
}
