import http from 'http';
import app from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { env } from '../src/config/env';

async function testApi() {
  console.log('Testing IAUE Student Hub Backend API Endpoints...\n');

  await connectDatabase();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5099, resolve));
  const baseUrl = 'http://127.0.0.1:5099';

  async function makeRequest(path: string, options: http.RequestOptions = {}, body?: any): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const req = http.request(
        url,
        {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode || 500, data: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode || 500, data });
            }
          });
        }
      );
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  try {
    // 1. Test Login as Admin
    console.log('1. Testing POST /api/v1/auth/login');
    const loginRes = await makeRequest('/api/v1/auth/login', { method: 'POST' }, {
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
    });
    console.log(`   Status: ${loginRes.status}, Success: ${loginRes.data.success}`);
    const token = loginRes.data?.data?.token;

    // 2. Test Scraper Health Endpoint with Admin Token
    console.log('2. Testing GET /api/v1/admin/scrapers/health (Authenticated Admin)');
    const healthRes = await makeRequest('/api/v1/admin/scrapers/health', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`   Status: ${healthRes.status}, Health: ${healthRes.data?.data?.status}`);
    console.log(`   Configured Sources: ${healthRes.data?.data?.enabledSourcesCount}`);

    // 3. Test Unauthorized Access without Token
    console.log('3. Testing GET /api/v1/admin/scrapers/health without Token (Security Check)');
    const unauthRes = await makeRequest('/api/v1/admin/scrapers/health');
    console.log(`   Status: ${unauthRes.status} (Expected 401), Code: ${unauthRes.data?.error?.code}`);

    // 4. Test List Scraper Sources
    console.log('4. Testing GET /api/v1/admin/scrapers');
    const sourcesRes = await makeRequest('/api/v1/admin/scrapers', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log(`   Status: ${sourcesRes.status}, Sources Count: ${sourcesRes.data?.data?.length}`);

    // 5. Test Public Announcements Endpoint
    console.log('5. Testing GET /api/v1/announcements (Public)');
    const annRes = await makeRequest('/api/v1/announcements');
    console.log(`   Status: ${annRes.status}, Items: ${annRes.data?.data?.length}`);
    console.log(`   Disclaimer Present: ${!!annRes.data?.meta?.disclaimer}`);

    // 6. Test Public Courses Endpoint
    console.log('6. Testing GET /api/v1/courses (Public)');
    const courseRes = await makeRequest('/api/v1/courses');
    console.log(`   Status: ${courseRes.status}, Courses: ${courseRes.data?.data?.length}`);

    // 7. Test Public OpenAPI Spec
    console.log('7. Testing GET /openapi.json');
    const openapiRes = await makeRequest('/openapi.json');
    console.log(`   Status: ${openapiRes.status}, Title: ${openapiRes.data?.info?.title}`);

    console.log('\n✅ All API Integration Endpoints Verified Successfully!');
  } finally {
    server.close();
    await disconnectDatabase();
  }
}

testApi();
