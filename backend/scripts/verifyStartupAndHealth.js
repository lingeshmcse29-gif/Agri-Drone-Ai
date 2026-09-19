const http = require('http');
const { startServer, app } = require('../server');
const { closeDB } = require('../config/database');

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body: data, json });
        });
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function verifyLive() {
  console.log('🚀 Launching backend server on port 5002 for live integration test...');
  let serverInstance = null;

  try {
    serverInstance = await startServer(5002);

    // 1. Health endpoint verification
    console.log('\nTesting GET http://127.0.0.1:5002/api/health:');
    const health = await fetch('http://127.0.0.1:5002/api/health');
    console.log('Status Code:', health.status);
    console.log('Response:', JSON.stringify(health.json, null, 2));

    if (health.json?.data?.mode !== 'DEMO' && health.json?.data?.mode !== 'LIVE') {
      throw new Error(`Unexpected mode: ${health.json?.data?.mode}`);
    }
    if (typeof health.json?.data?.uptime !== 'number') {
      throw new Error('Uptime is not a number');
    }

    // 2. Root route verification
    console.log('\nTesting GET http://127.0.0.1:5002/:');
    const root = await fetch('http://127.0.0.1:5002/');
    console.log('Status Code:', root.status);
    console.log('Response:', JSON.stringify(root.json, null, 2));

    // 3. Security Headers check
    console.log('\nVerifying Security Headers on Root:');
    console.log('x-request-id:', root.headers['x-request-id']);
    console.log('x-content-type-options:', root.headers['x-content-type-options']);
    console.log('x-frame-options:', root.headers['x-frame-options']);
    console.log('referrer-policy:', root.headers['referrer-policy']);

    if (!root.headers['x-request-id']) throw new Error('Missing x-request-id header');
    if (root.headers['x-content-type-options'] !== 'nosniff') throw new Error('Missing nosniff');

    // 4. 404 Route check
    console.log('\nTesting 404 handler GET /api/unimplemented-route:');
    const notFound = await fetch('http://127.0.0.1:5002/api/unimplemented-route');
    console.log('Status Code:', notFound.status);
    console.log('Response:', JSON.stringify(notFound.json, null, 2));
    if (notFound.status !== 404 || notFound.json?.error?.code !== 'ROUTE_NOT_FOUND') {
      throw new Error('404 handler failed standard error envelope verification');
    }

    // 5. CORS check for unallowed origin
    console.log('\nTesting CORS rejection for origin: http://unauthorized-domain.com:');
    const corsTest = await fetch('http://127.0.0.1:5002/api/health', {
      headers: { Origin: 'http://unauthorized-domain.com' },
    });
    console.log('Status Code:', corsTest.status);
    console.log('Response:', JSON.stringify(corsTest.json, null, 2));
    if (corsTest.status !== 403 || corsTest.json?.error?.code !== 'CORS_ERROR') {
      throw new Error('CORS did not reject unauthorized origin');
    }

    console.log('\n✅ LIVE SERVER INTEGRATION VERIFICATION PASSED 100%!');
  } finally {
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    await closeDB();
  }
}

verifyLive().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
