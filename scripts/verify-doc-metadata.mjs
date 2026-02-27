#!/usr/bin/env node
/**
 * Doc Metadata Guard
 *
 * Validates that all markdown files in docs/ and shared/docs/
 * have required metadata headers at the top.
 *
 * Exit codes:
 *   0 = all files valid
 *   1 = validation errors found
 */

import { promises as fs } from 'fs';
import { join, relative } from 'path';

// Configuration
const TARGET_DIRS = ['docs', 'shared/docs'];
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /dist/,
  /build/,
  /\.next/,
  /coverage/,
  /docs[\\/]audit/,        // Archive/audit reports - exempt from metadata requirement (cross-platform)
];

const REQUIRED_KEYS = ['Owner', 'Status', 'Version', 'LastUpdated', 'Canonical'];
const ALLOWED_STATUS = ['active', 'draft', 'deprecated'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_CANONICAL = ['true', 'false'];

const errors = [];
const warnings = [];

/**
 * Check if a path should be excluded
 */
function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Recursively find all markdown files
 */
async function findMarkdownFiles(dir, baseDir = dir) {
  const files = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(baseDir, fullPath);

      if (shouldExclude(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await findMarkdownFiles(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      errors.push({ file: dir, reason: `Cannot read directory: ${err.message}` });
    }
  }

  return files;
}

/**
 * Extract frontmatter from first ~80 lines of file
 */
async function extractFrontmatter(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).slice(0, 80);

    // Check if file starts with ---
    if (!lines[0] || lines[0].trim() !== '---') {
      return { hasFrontmatter: false, data: null, error: 'Missing frontmatter start marker (---)' };
    }

    // Find closing ---
    const closingIndex = lines.slice(1).findIndex(line => line.trim() === '---');
    if (closingIndex === -1) {
      return { hasFrontmatter: false, data: null, error: 'Missing frontmatter end marker (---)' };
    }

    const frontmatterLines = lines.slice(1, closingIndex + 1);
    const data = {};

    for (const line of frontmatterLines) {
      const match = line.match(/^([A-Za-z]+):\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        data[key] = value.trim();
      }
    }

    return { hasFrontmatter: true, data, error: null };
  } catch (err) {
    return { hasFrontmatter: false, data: null, error: `Cannot read file: ${err.message}` };
  }
}

/**
 * Validate metadata for a single file
 */
function validateMetadata(filePath, frontmatter) {
  const fileName = relative(process.cwd(), filePath);
  const localErrors = [];

  if (!frontmatter.hasFrontmatter) {
    localErrors.push(frontmatter.error || 'No frontmatter found');
    return { file: fileName, errors: localErrors };
  }

  const { data } = frontmatter;

  // Check required keys
  for (const key of REQUIRED_KEYS) {
    if (!(key in data) || data[key] === '') {
      localErrors.push(`Missing or empty required key: ${key}`);
    }
  }

  // Validate Status
  if (data.Status && !ALLOWED_STATUS.includes(data.Status)) {
    localErrors.push(`Invalid Status "${data.Status}". Allowed: ${ALLOWED_STATUS.join(', ')}`);
  }

  // Validate Canonical
  if (data.Canonical && !ALLOWED_CANONICAL.includes(data.Canonical)) {
    localErrors.push(`Invalid Canonical "${data.Canonical}". Allowed: ${ALLOWED_CANONICAL.join(', ')}`);
  }

  // Validate LastUpdated format
  if (data.LastUpdated && !DATE_REGEX.test(data.LastUpdated)) {
    localErrors.push(`Invalid LastUpdated "${data.LastUpdated}". Expected: YYYY-MM-DD`);
  }

  return { file: fileName, errors: localErrors };
}

/**
 * Main validation function
 */
async function main() {
  console.log('🔍 Doc Metadata Guard');
  console.log('=====================\n');

  const allFiles = [];

  // Find all markdown files
  for (const dir of TARGET_DIRS) {
    const files = await findMarkdownFiles(dir, process.cwd());
    allFiles.push(...files);
  }

  if (allFiles.length === 0) {
    console.log('⚠️ No markdown files found in target directories');
    process.exit(0);
  }

  console.log(`Found ${allFiles.length} markdown files to validate\n`);

  // Validate each file
  let passed = 0;
  let failed = 0;

  for (const file of allFiles) {
    const frontmatter = await extractFrontmatter(file);
    const result = validateMetadata(file, frontmatter);

    if (result.errors.length > 0) {
      failed++;
      errors.push(result);
    } else {
      passed++;
    }
  }

  // Report results
  console.log(`\n✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}\n`);

  if (errors.length > 0) {
    console.log('Validation Errors:');
    console.log('------------------');

    for (const { file, errors: fileErrors } of errors) {
      console.log(`\n📄 ${file}`);
      for (const error of fileErrors) {
        console.log(`   ❌ ${error}`);
      }
    }

    console.log('\n------------------');
    console.log(`❌ Doc Metadata Guard failed: ${failed} file(s) have invalid headers\n`);
    process.exit(1);
  }

  console.log('✅ All markdown files have valid metadata headers\n');
  process.exit(0);
}

main().catch(err => {
  console.error('💥 Fatal error:', err.message);
  process.exit(1);
});
