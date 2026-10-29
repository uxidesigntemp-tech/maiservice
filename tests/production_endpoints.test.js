// tests/production_endpoints.test.js
// Verification of core production API endpoints for MAI Service Marketplace
const assert = require('assert');
const http = require('http');
const app = require('../server/server');
const { handler: netlifyHandler } = require('../netlify/functions/api');

const PORT = 5003;

async function testHttpEndpoint(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          contentType: res.headers['content-type'] || '',
          body: data
        });
      });
    }).on('error', reject);
  });
}

async function testNetlifyEndpoint(path) {
  const event = {
    httpMethod: 'GET',
    path: `/.netlify/functions/api${path.replace(/^\/api/, '')}`,
    headers: { accept: 'application/json' },
    queryStringParameters: {}
  };
  const res = await netlifyHandler(event, {});
  return {
    statusCode: res.statusCode,
    contentType: res.headers['content-type'] || '',
    body: res.body
  };
}

async function runTests() {
  console.log('====================================================');
  console.log('  TESTING PRODUCTION API ENDPOINTS (HTTP & NETLIFY) ');
  console.log('====================================================\n');

  const server = app.listen(PORT, async () => {
    try {
      const endpoints = [
        {
          name: 'Health Check',
          path: '/api/health',
          validate: (data) => {
            assert.strictEqual(data.status, 'ok', 'Status must be ok');
            assert(data.app.includes('MAI Service'), 'App name must be MAI Service');
          }
        },
        {
          name: 'Categories Catalog',
          path: '/api/categories',
          validate: (data) => {
            assert(Array.isArray(data), 'Categories must be an array');
            assert(data.length >= 6, `Expected >= 6 categories, got ${data.length}`);
            const names = data.map(c => c.name);
            assert(names.includes('Carpenter'), 'Must include Carpenter');
            assert(names.includes('Plumber'), 'Must include Plumber');
            assert(names.includes('Electrician'), 'Must include Electrician');
          }
        },
        {
          name: 'Services Catalog',
          path: '/api/services',
          validate: (data) => {
            assert(Array.isArray(data), 'Services must be an array');
            assert(data.length >= 10, `Expected >= 10 services, got ${data.length}`);
            const titles = data.map(s => s.title);
            assert(titles.includes('PVC Door Installation'), 'Must include PVC Door Installation');
            const pvc = data.find(s => s.title === 'PVC Door Installation');
            assert.strictEqual(pvc.price, 100, 'PVC Door Installation rate must be £100/hr');
          }
        },
        {
          name: 'Professionals Catalog',
          path: '/api/professionals',
          validate: (data) => {
            assert(Array.isArray(data), 'Professionals must be an array');
            assert(data.length >= 6, `Expected >= 6 pros, got ${data.length}`);
            const names = data.map(p => p.name);
            assert(names.includes('Thomas Jenkins'), 'Must include Thomas Jenkins');
            assert(names.includes('Elena Rostova'), 'Must include Elena Rostova');
          }
        }
      ];

      for (const ep of endpoints) {
        console.log(`[TESTING] ${ep.name} (${ep.path})`);

        // Test 1: Express direct HTTP
        const httpRes = await testHttpEndpoint(ep.path);
        assert.strictEqual(httpRes.statusCode, 200, `HTTP status code must be 200 for ${ep.path}`);
        assert(httpRes.contentType.includes('application/json'), `Content-Type must be application/json, got ${httpRes.contentType}`);
        const httpData = JSON.parse(httpRes.body);
        ep.validate(httpData);
        console.log(`  ✓ Express HTTP: 200 OK, application/json, verified payload`);

        // Test 2: Netlify Serverless Function adapter
        const netlifyRes = await testNetlifyEndpoint(ep.path);
        assert.strictEqual(netlifyRes.statusCode, 200, `Netlify status code must be 200 for ${ep.path}`);
        assert(netlifyRes.contentType.includes('application/json'), `Netlify Content-Type must be application/json, got ${netlifyRes.contentType}`);
        const netlifyData = JSON.parse(netlifyRes.body);
        ep.validate(netlifyData);
        console.log(`  ✓ Netlify Serverless: 200 OK, application/json, verified payload`);
      }

      console.log('\n====================================================');
      console.log('  ALL PRODUCTION ENDPOINTS RETURN VALID REAL DATA!  ');
      console.log('====================================================\n');
    } catch (err) {
      console.error('Test failure:', err);
      process.exitCode = 1;
    } finally {
      server.close();
    }
  });
}

runTests();
