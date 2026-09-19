const assert = require('assert');
const { validateAndLoadConfig } = require('../config/env');

console.log('\n--- Running Environment Validation Tests ---');

function makeBaseConfig(overrides = {}) {
  return {
    APP_MODE: 'DEMO',
    NODE_ENV: 'development',
    PORT: '5000',
    MONGO_URI: 'mongodb://localhost:27017/agri_test',
    JWT_SECRET: 'super_secret_jwt_key_for_testing_12345',
    OLLAMA_URL: 'http://127.0.0.1:11434',
    OLLAMA_MODEL: 'qwen3-vl:8b',
    UPLOAD_DIR: './uploads',
    FRONTEND_URL: 'http://localhost:5173',
    CORS_ORIGINS: 'http://localhost:5173',
    ...overrides,
  };
}

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    throw err;
  }
}

// 1. Valid DEMO config
test('VALID DEMO CONFIG: succeeds and returns normalized config', () => {
  const conf = validateAndLoadConfig(makeBaseConfig({ APP_MODE: 'DEMO' }));
  assert.strictEqual(conf.APP_MODE, 'DEMO');
  assert.strictEqual(conf.isDemo, true);
  assert.strictEqual(conf.isLive, false);
  assert.strictEqual(conf.PORT, 5000);
});

// 2. Valid LIVE config
test('VALID LIVE CONFIG: succeeds when requirements are met', () => {
  const conf = validateAndLoadConfig(
    makeBaseConfig({
      APP_MODE: 'LIVE',
      JWT_SECRET: 'extremely_secure_random_key_production_987654321',
    })
  );
  assert.strictEqual(conf.APP_MODE, 'LIVE');
  assert.strictEqual(conf.isLive, true);
  assert.strictEqual(conf.isDemo, false);
});

// 3. Missing APP_MODE
test('MISSING APP_MODE: fails fast', () => {
  assert.throws(() => {
    validateAndLoadConfig(makeBaseConfig({ APP_MODE: '' }));
  }, /APP_MODE is required/);
});

// 4. Invalid APP_MODE
test('INVALID APP_MODE: rejects arbitrary values like "production" or "staging"', () => {
  assert.throws(() => {
    validateAndLoadConfig(makeBaseConfig({ APP_MODE: 'production' }));
  }, /Invalid APP_MODE/);

  assert.throws(() => {
    validateAndLoadConfig(makeBaseConfig({ APP_MODE: 'staging' }));
  }, /Invalid APP_MODE/);
});

// 5. Missing MONGO_URI
test('MISSING MONGO_URI: fails fast', () => {
  assert.throws(() => {
    validateAndLoadConfig(makeBaseConfig({ MONGO_URI: '', MONGODB_URI: '' }));
  }, /MONGO_URI is required/);
});

// 6. Invalid MONGO_URI protocol
test('INVALID MONGO_URI: rejects non-mongo URIs', () => {
  assert.throws(() => {
    validateAndLoadConfig(makeBaseConfig({ MONGO_URI: 'http://localhost:27017' }));
  }, /must begin with "mongodb:\/\/"/);
});

// 7. Missing JWT_SECRET
test('MISSING JWT_SECRET: fails fast', () => {
  assert.throws(() => {
    validateAndLoadConfig(makeBaseConfig({ JWT_SECRET: '' }));
  }, /JWT_SECRET is mandatory/);
});

// 8. Weak JWT_SECRET in LIVE mode
test('WEAK JWT_SECRET IN LIVE: rejects short secret (< 16 chars)', () => {
  assert.throws(() => {
    validateAndLoadConfig(
      makeBaseConfig({
        APP_MODE: 'LIVE',
        JWT_SECRET: 'short_key',
      })
    );
  }, /must be at least 16 characters/);
});

test('WEAK JWT_SECRET IN LIVE: rejects known weak placeholder', () => {
  assert.throws(() => {
    validateAndLoadConfig(
      makeBaseConfig({
        APP_MODE: 'LIVE',
        JWT_SECRET: 'replace_with_a_strong_secret',
      })
    );
  }, /cannot be a known weak or placeholder/);
});

// 9. Invalid PORT
test('INVALID PORT: rejects negative or out-of-range ports', () => {
  assert.throws(() => {
    validateAndLoadConfig(makeBaseConfig({ PORT: '99999' }));
  }, /Must be an integer between 1 and 65535/);

  assert.throws(() => {
    validateAndLoadConfig(makeBaseConfig({ PORT: 'not_a_number' }));
  }, /Must be an integer between 1 and 65535/);
});

// 10. Invalid URL (OLLAMA_URL)
test('INVALID OLLAMA_URL: rejects invalid protocols and malformed URLs', () => {
  assert.throws(() => {
    validateAndLoadConfig(makeBaseConfig({ OLLAMA_URL: 'ftp://bad-url' }));
  }, /Must be a valid HTTP\/HTTPS URL/);
});

// 11. Missing OLLAMA_MODEL
test('MISSING OLLAMA_MODEL: fails fast', () => {
  assert.throws(() => {
    validateAndLoadConfig(makeBaseConfig({ OLLAMA_MODEL: '' }));
  }, /OLLAMA_MODEL is required/);
});

// 12. Invalid Upload Directory Configuration
test('MISSING UPLOAD_DIR: fails fast', () => {
  assert.throws(() => {
    validateAndLoadConfig(makeBaseConfig({ UPLOAD_DIR: '' }));
  }, /UPLOAD_DIR is required/);
});

test('INVALID UPLOAD DIRECTORY CONFIGURATION: rejects path traversal out of backend', () => {
  assert.throws(() => {
    validateAndLoadConfig(makeBaseConfig({ UPLOAD_DIR: '../../outside_directory' }));
  }, /Path traversal outside backend is prohibited/);
});

// 13. Forbidden CORS Wildcard
test('CORS WILDCARD: rejects "*" in CORS_ORIGINS', () => {
  assert.throws(() => {
    validateAndLoadConfig(makeBaseConfig({ CORS_ORIGINS: 'http://localhost:5173,*' }));
  }, /Wildcard "\*" is strictly forbidden/);
});

// 13. LIVE overrides USE_MEMORY_DB
test('LIVE MODE: strictly prevents memory database even if USE_MEMORY_DB=true', () => {
  const conf = validateAndLoadConfig(
    makeBaseConfig({
      APP_MODE: 'LIVE',
      USE_MEMORY_DB: 'true',
      JWT_SECRET: 'extremely_secure_production_secret_key_123',
    })
  );
  assert.strictEqual(conf.USE_MEMORY_DB, false);
});

console.log(`\nAll ${passed}/${total} Environment Validation Tests Passed!`);
