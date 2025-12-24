#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-ssr',
  'playwright-report',
  'test-results',
  '.vercel',
  '.vscode',
  '.idea',
]);

const TEXT_EXTENSIONS = new Set([
  '.env',
  '.local',
  '.example',
  '.txt',
  '.md',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.json',
  '.yml',
  '.yaml',
  '.sh',
  '.html',
  '.css',
]);

const PATTERNS = [
  { name: 'stripe_secret_key', re: /\bsk_(live|test)_[A-Za-z0-9]+\b/g },
  { name: 'stripe_publishable_key', re: /\bpk_(live|test)_[A-Za-z0-9]+\b/g },
  { name: 'stripe_webhook_secret', re: /\bwhsec_[A-Za-z0-9]+\b/g },
  { name: 'stripe_meter_id', re: /\bmtr_[A-Za-z0-9]+\b/g },
  { name: 'anthropic_key', re: /\bsk-ant-[A-Za-z0-9-_]+\b/g },
  // OpenAI keys are typically sk-..., but avoid matching common non-keys.
  { name: 'openai_key_like', re: /\bsk-[A-Za-z0-9]{16,}\b/g },
  { name: 'langsmith_key', re: /\blsv2_[A-Za-z0-9_]+\b/g },
  { name: 'google_api_key', re: /\bAIza[0-9A-Za-z\-_]{25,}\b/g },
  // Supabase JWT-like keys (anon/service role) are JWTs; match header.payload.signature shape.
  { name: 'jwt_like', re: /\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/g },
];

function isTextFile(filePath) {
  const base = path.basename(filePath);
  if (base.startsWith('.env')) return true;
  const ext = path.extname(filePath);
  return TEXT_EXTENSIONS.has(ext);
}

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name === '.DS_Store') continue;
    const full = path.join(dir, ent.name);

    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(ent.name)) continue;
      walk(full, out);
      continue;
    }

    if (!ent.isFile()) continue;
    if (!isTextFile(full)) continue;

    out.push(full);
  }
  return out;
}

function maskValue(value) {
  const trimmed = value.trim();
  if (trimmed.length <= 12) return '[masked]';
  const head = trimmed.slice(0, 6);
  const tail = trimmed.slice(-4);
  return `${head}…${tail} (len=${trimmed.length})`;
}

function isPlaceholder(value) {
  const v = value.toLowerCase();
  return (
    v.includes('your-') ||
    v.includes('placeholder') ||
    v.includes('example') ||
    v.includes('xxx') ||
    v === 'test123'
  );
}

function findLineNumber(haystack, idx) {
  // 1-based line number
  return haystack.slice(0, idx).split('\n').length;
}

const files = walk(ROOT);

const findings = [];
for (const filePath of files) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    continue;
  }

  for (const pat of PATTERNS) {
    pat.re.lastIndex = 0;
    let match;
    while ((match = pat.re.exec(content)) !== null) {
      const value = match[0];
      const index = match.index;
      findings.push({
        file: path.relative(ROOT, filePath),
        line: findLineNumber(content, index),
        type: pat.name,
        placeholder: isPlaceholder(value),
        masked: maskValue(value),
      });
    }
  }
}

findings.sort((a, b) =>
  a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)
);

const summary = {};
for (const f of findings) {
  summary[f.type] ??= { total: 0, placeholders: 0 };
  summary[f.type].total += 1;
  if (f.placeholder) summary[f.type].placeholders += 1;
}

const report = {
  root: ROOT,
  scannedFiles: files.length,
  totalFindings: findings.length,
  summary,
  findings,
};

console.log(JSON.stringify(report, null, 2));
