#!/usr/bin/env node

/**
 * Security Headers Test Script
 * 
 * Tests that all security headers are properly configured
 * Run against development or production server
 * 
 * Usage: node scripts/test-security-headers.mjs http://localhost:3000
 */

import { fetch } from 'undici';

const targetUrl = process.argv[2];

if (!targetUrl) {
  console.error('❌ Usage: node test-security-headers.mjs <url>');
  console.error('   Example: node test-security-headers.mjs http://localhost:3000');
  process.exit(1);
}

const requiredHeaders = {
  'x-frame-options': { expected: 'DENY', critical: true },
  'x-content-type-options': { expected: 'nosniff', critical: true },
  'content-security-policy': { expected: null, critical: true }, // Just needs to exist
  'referrer-policy': { expected: null, critical: false }, // Just needs to exist
  'strict-transport-security': { expected: null, critical: false }, // Only in prod
};

async function testSecurityHeaders(baseUrl) {
  console.log('🔒 Security Headers Test');
  console.log('=======================\n');
  console.log(`Target: ${baseUrl}\n`);
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
  };
  
  try {
    const response = await fetch(baseUrl, { method: 'GET' });
    const headers = {};
    
    for (const [key, value] of response.headers.entries()) {
      headers[key.toLowerCase()] = value;
    }
    
    console.log('Response Status:', response.status, response.ok ? '✅' : '❌');
    console.log('\nHeader Analysis:\n');
    
    for (const [headerName, config] of Object.entries(requiredHeaders)) {
      const actualValue = headers[headerName];
      
      if (actualValue === undefined || actualValue === null) {
        if (config.critical) {
          console.log(`❌ MISSING (Critical): ${headerName}`);
          results.failed++;
          results.details.push({ header: headerName, status: 'FAIL', reason: 'Missing critical header' });
        } else {
          console.log(`⚠️  MISSING (Optional): ${headerName}`);
          results.warnings++;
          results.details.push({ header: headerName, status: 'WARN', reason: 'Missing optional header' });
        }
      } else if (config.expected && actualValue !== config.expected) {
        console.log(`❌ WRONG VALUE: ${headerName}`);
        console.log(`   Expected: ${config.expected}`);
        console.log(`   Actual:   ${actualValue}`);
        results.failed++;
        results.details.push({ 
          header: headerName, 
          status: 'FAIL', 
          reason: `Expected "${config.expected}", got "${actualValue}"` 
        });
      } else {
        console.log(`✅ PASS: ${headerName}`);
        if (actualValue.length > 80) {
          console.log(`   Value: ${actualValue.substring(0, 80)}...`);
        } else {
          console.log(`   Value: ${actualValue}`);
        }
        results.passed++;
        results.details.push({ header: headerName, status: 'PASS' });
      }
      console.log('');
    }
    
    // Additional checks
    console.log('Additional Security Checks:\n');
    
    // Check CORS headers
    if (headers['access-control-allow-origin']) {
      const corsValue = headers['access-control-allow-origin'];
      if (corsValue === '*') {
        console.log('⚠️  WARNING: CORS allows all origins (*) - consider restricting in production');
        results.warnings++;
      } else {
        console.log(`✅ CORS restricted to: ${corsValue}`);
        results.passed++;
      }
    } else {
      console.log('ℹ️  No CORS headers (may be OK for same-origin only)');
    }
    
    // Summary
    console.log('\n\n📊 SUMMARY');
    console.log('========\n');
    console.log(`✅ Passed:    ${results.passed}`);
    console.log(`❌ Failed:    ${results.failed}`);
    console.log(`⚠️  Warnings: ${results.warnings}`);
    console.log('');
    
    if (results.failed > 0) {
      console.log('❌ SECURITY HEADERS TEST FAILED');
      console.log('\nCritical issues must be resolved before production deployment!');
      process.exit(1);
    } else if (results.warnings > 0) {
      console.log('⚠️  Security headers present with warnings');
      console.log('\nReview warnings and address before production if possible.');
      process.exit(0);
    } else {
      console.log('✅ All security headers properly configured!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('\nMake sure the target server is running and accessible.');
    process.exit(1);
  }
}

testSecurityHeaders(targetUrl);
