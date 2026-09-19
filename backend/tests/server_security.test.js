const http = require('http');
const assert = require('assert');

// Configure test environment variables before loading server
process.env.APP_MODE = 'DEMO';
process.env.NODE_ENV = 'test';
process.env.PORT = '5099';
process.env.MONGO_URI = 'mongodb://localhost:27017/agri_test';
process.env.JWT_SECRET = 'super_secret_test_key_at_least_16_chars';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.CORS_ORIGINS = 'http://localhost:5173,http://localhost:3000';
process.env.USE_MEMORY_DB = 'true';

delete require.cache[require.resolve('../config/env')];
const { app } = require('../server');

console.log('\n--- Running Server Security, CORS & Error Contract Tests ---');

function makeRequest(server, { method = 'GET', path = '/', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch {
            // not JSON
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: rawData,
            json,
          });
        });
      }
    );

    req.on('error', reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function runServerSecurityTests() {
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
      throw err;
    }
  }

  // Spin up test server on ephemeral port (0)
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  try {
    // 1. Request ID header
    await test('REQUEST ID: Injects X-Request-ID header in responses', async () => {
      const res = await makeRequest(server, { path: '/' });
      assert(res.headers['x-request-id'], 'Missing X-Request-ID response header');
      assert.strictEqual(typeof res.headers['x-request-id'], 'string');
    });

    // 2. Security Headers
    await test('SECURITY HEADERS: Helmet headers are present', async () => {
      const res = await makeRequest(server, { path: '/' });
      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
      assert.strictEqual(res.headers['x-frame-options'], 'DENY');
      assert.strictEqual(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
    });

    // 3. CORS Allowed Origin
    await test('CORS: Configured frontend origin passes with Access-Control-Allow-Origin', async () => {
      const res = await makeRequest(server, {
        path: '/',
        headers: { Origin: 'http://localhost:5173' },
      });
      assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:5173');
    });

    // 4. CORS Rejected Origin
    await test('CORS: Unconfigured origin is rejected with 403 and CORS_ERROR envelope', async () => {
      const res = await makeRequest(server, {
        path: '/api/health',
        headers: { Origin: 'http://malicious-site.com' },
      });
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.json.success, false);
      assert.strictEqual(res.json.error.code, 'CORS_ERROR');
    });

    // 5. CORS Preflight OPTIONS
    await test('CORS: Preflight OPTIONS request responds with allowed methods and headers', async () => {
      const res = await makeRequest(server, {
        method: 'OPTIONS',
        path: '/api/auth/login',
        headers: {
          Origin: 'http://localhost:5173',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,Authorization',
        },
      });
      assert(res.statusCode === 200 || res.statusCode === 204);
      assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:5173');
      assert(res.headers['access-control-allow-methods'].includes('POST'));
    });

    // 6. 404 Route Not Found Standard Envelope
    await test('NOT FOUND HANDLER: Nonexistent API route returns 404 standard envelope', async () => {
      const res = await makeRequest(server, { path: '/api/nonexistent-endpoint-12345' });
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.json.success, false);
      assert.strictEqual(res.json.error.code, 'ROUTE_NOT_FOUND');
      assert(res.json.error.message.includes('/api/nonexistent-endpoint-12345'));
    });

    // 7. Malformed JSON Body
    await test('ERROR HANDLER: Malformed JSON body returns 400 INVALID_JSON envelope', async () => {
      const res = await makeRequest(server, {
        method: 'POST',
        path: '/api/auth/login',
        headers: { 'Content-Type': 'application/json' },
        body: '{"malformed_json: missing_brace',
      });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.json.success, false);
      assert.strictEqual(res.json.error.code, 'INVALID_JSON');
    });

    // 8. Health Endpoint metrics
    await test('HEALTH ENDPOINT: Returns real process uptime, mode, and DB state', async () => {
      const res = await makeRequest(server, { path: '/api/health' });
      assert(res.json.data, 'Missing data object in health response');
      assert.strictEqual(res.json.data.mode, 'DEMO');
      assert(typeof res.json.data.uptime === 'number', 'Uptime must be a number');
      assert(res.json.data.uptime >= 0, 'Uptime must be >= 0');
      assert(res.json.data.database, 'Database state must be reported');
      assert(res.json.data.timestamp, 'Timestamp must be reported');
    });

    // 9. Payload Too Large (> 1MB JSON)
    await test('ERROR HANDLER: Payload exceeding 1MB returns 413 PAYLOAD_TOO_LARGE envelope', async () => {
      // 1.2MB payload
      const largePayload = JSON.stringify({ data: 'x'.repeat(1.2 * 1024 * 1024) });
      const res = await makeRequest(server, {
        method: 'POST',
        path: '/api/auth/login',
        headers: { 'Content-Type': 'application/json' },
        body: largePayload,
      });
      assert.strictEqual(res.statusCode, 413);
      assert.strictEqual(res.json.success, false);
      assert.strictEqual(res.json.error.code, 'PAYLOAD_TOO_LARGE');
    });

    // 10. Unauthorized Request with invalid token
    await test('AUTH: Invalid token format returns 401 UNAUTHORIZED envelope', async () => {
      const express = require('express');
      const { protect } = require('../middleware/authMiddleware');
      const { errorHandler } = require('../middleware/errorMiddleware');
      const testApp = express();
      testApp.get('/test-auth', protect, (req, res) => res.json({ success: true }));
      testApp.use(errorHandler);

      const testServer = await new Promise((resolve) => {
        const s = testApp.listen(0, () => resolve(s));
      });

      try {
        const res = await makeRequest(testServer, {
          path: '/test-auth',
          headers: { Authorization: 'Bearer invalid_jwt_token_format' },
        });
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.json.success, false);
        assert.strictEqual(res.json.error.code, 'UNAUTHORIZED');
      } finally {
        await new Promise((resolve) => testServer.close(resolve));
      }
    });

    // 11. Missing authorization header on protected route
    await test('AUTH: Missing Bearer token returns 401 UNAUTHORIZED envelope', async () => {
      const express = require('express');
      const { protect } = require('../middleware/authMiddleware');
      const { errorHandler } = require('../middleware/errorMiddleware');
      const testApp = express();
      testApp.get('/test-auth', protect, (req, res) => res.json({ success: true }));
      testApp.use(errorHandler);

      const testServer = await new Promise((resolve) => {
        const s = testApp.listen(0, () => resolve(s));
      });

      try {
        const res = await makeRequest(testServer, {
          path: '/test-auth',
        });
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.json.success, false);
        assert.strictEqual(res.json.error.code, 'UNAUTHORIZED');
      } finally {
        await new Promise((resolve) => testServer.close(resolve));
      }
    });

    console.log(`\nAll ${passed}/${total} Server Security & Error Contract Tests Passed!`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

module.exports = runServerSecurityTests;

if (require.main === module) {
  runServerSecurityTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
