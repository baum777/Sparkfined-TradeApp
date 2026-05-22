#!/usr/bin/env node

/**
 * JWT Secret Rotation Script
 * 
 * Usage: node scripts/rotate-jwt-secret.mjs --service backend|api [--dry-run]
 * 
 * Process:
 * 1. Generate new cryptographically secure secret (32 bytes)
 * 2. Display old vs new secret (for manual rotation)
 * 3. Provide deployment instructions for Railway/Vercel
 * 
 * Security Notes:
 * - Never log secrets to files or stdout in production
 * - Use grace period when rotating (accept both old and new tokens)
 * - Invalidate all existing sessions after rotation (optional)
 */

import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const args = process.argv.slice(2);
const serviceArg = args.find(arg => arg.startsWith('--service='));
const dryRun = args.includes('--dry-run');

if (!serviceArg) {
  console.error('❌ Usage: node rotate-jwt-secret.mjs --service=backend|api [--dry-run]');
  console.error('\nOptions:');
  console.error('  --service=backend  Rotate JWT_SECRET for backend/');
  console.error('  --service=api      Rotate AUTH_JWT_SECRET for api/');
  console.error('  --dry-run          Show what would be done without making changes');
  process.exit(1);
}

const service = serviceArg.split('=')[1];

if (!['backend', 'api'].includes(service)) {
  console.error('❌ Invalid service. Must be "backend" or "api"');
  process.exit(1);
}

// Generate new secret
function generateSecret() {
  return randomBytes(32).toString('base64');
}

// Get current secret from .env file
function getCurrentSecret(serviceName) {
  const envPath = join(__dirname, '..', serviceName === 'api' ? 'api' : 'backend', '.env');
  
  try {
    const content = readFileSync(envPath, 'utf-8');
    const varName = serviceName === 'api' ? 'AUTH_JWT_SECRET' : 'JWT_SECRET';
    const match = content.match(new RegExp(`^${varName}=(.*)$`, 'm'));
    
    if (match && match[1]) {
      // Mask secret for display (show first 4 and last 4 chars)
      const secret = match[1];
      const masked = secret.length > 8 
        ? `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`
        : '****';
      return { found: true, value: secret, masked, path: envPath };
    }
    
    return { found: false, value: null, masked: null, path: envPath };
  } catch (error) {
    return { found: false, value: null, masked: null, path: envPath, error: error.message };
  }
}

// Main rotation logic
async function rotateSecret(serviceName) {
  console.log('🔐 JWT Secret Rotation');
  console.log('=====================\n');
  console.log(`Service: ${serviceName}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}\n`);
  
  // Get current secret
  const current = getCurrentSecret(serviceName);
  const newSecret = generateSecret();
  
  console.log('Current Secret:');
  if (current.found) {
    console.log(`  Path: ${current.path}`);
    console.log(`  Value: ${current.masked}`);
  } else if (current.error) {
    console.log(`  ⚠️  Could not read: ${current.error}`);
  } else {
    console.log(`  ⚠️  Not found in ${current.path}`);
  }
  
  console.log('\nNew Secret:');
  console.log(`  Generated: ${newSecret.substring(0, 8)}...${newSecret.substring(newSecret.length - 8)}`);
  console.log(`  Length: ${newSecret.length} characters`);
  console.log(`  Entropy: ~${Math.floor(newSecret.length * 6)} bits\n`);
  
  if (dryRun) {
    console.log('✅ DRY RUN complete. No changes made.');
    console.log('\nTo perform actual rotation, run without --dry-run flag');
    return;
  }
  
  // Deployment instructions
  console.log('📋 DEPLOYMENT INSTRUCTIONS');
  console.log('=========================\n');
  
  if (serviceName === 'backend') {
    console.log('For Railway Deployment:');
    console.log('  1. Go to Railway Dashboard → Your Project → Variables');
    console.log('  2. Update JWT_SECRET with the new value below');
    console.log('  3. Redeploy the service');
    console.log('');
    console.log('For Local Development:');
    console.log(`  1. Update backend/.env:`);
    console.log(`     JWT_SECRET=${newSecret}`);
    console.log('  2. Restart the backend server');
  } else if (serviceName === 'api') {
    console.log('For Vercel Deployment:');
    console.log('  1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
    console.log('  2. Update AUTH_JWT_SECRET with the new value below');
    console.log('  3. Redeploy all environments (Production, Preview, Development)');
    console.log('');
    console.log('For Local Development:');
    console.log(`  1. Create/update api/.env:`);
    console.log(`     AUTH_JWT_SECRET=${newSecret}`);
  }
  
  console.log('\n⚠️  CRITICAL SECURITY NOTES');
  console.log('========================\n');
  console.log('1. Grace Period: Consider accepting both old and new tokens for 5-10 minutes');
  console.log('   to avoid disrupting active users during rotation.');
  console.log('');
  console.log('2. Session Invalidation: All existing sessions will be invalidated after');
  console.log('   rotation unless you implement a grace period.');
  console.log('');
  console.log('3. Audit Log: Record this rotation event with timestamp and operator.');
  console.log('');
  console.log('4. Monitoring: Watch for increased 401 errors post-rotation.');
  console.log('');
  
  console.log('🔑 NEW SECRET VALUE');
  console.log('==================\n');
  console.log('Copy this value securely (do not share via chat/email):');
  console.log('');
  console.log(`  ${newSecret}`);
  console.log('');
  console.log('⚠️  Store this in a secure password manager immediately!');
  console.log('');
  
  // Optional: Write to secure file (only in local dev)
  if (process.env.NODE_ENV !== 'production' && !dryRun) {
    const backupPath = join(__dirname, `jwt-secret-backup-${Date.now()}.txt`);
    try {
      writeFileSync(backupPath, `# JWT Secret Backup - ${new Date().toISOString()}\n# DELETE THIS FILE AFTER SECURE STORAGE!\n\n${serviceName === 'api' ? 'AUTH_JWT_SECRET' : 'JWT_SECRET'}=${newSecret}\n`, { mode: 0o600 });
      console.log(`💾 Backup written to: ${backupPath}`);
      console.log('   ⚠️  DELETE THIS FILE AFTER SECURE STORAGE!\n');
    } catch (error) {
      console.log(`⚠️  Could not write backup file: ${error.message}\n`);
    }
  }
  
  console.log('✅ Rotation complete!');
  console.log('\nNext steps:');
  console.log('  1. Update deployment platform with new secret');
  console.log('  2. Monitor logs for authentication errors');
  console.log('  3. Update documentation if needed');
  console.log('  4. Schedule next rotation (recommended: every 90 days)');
}

// Run rotation
rotateSecret(service).catch(error => {
  console.error('❌ Rotation failed:', error.message);
  process.exit(1);
});
