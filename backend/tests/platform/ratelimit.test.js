const { loadApp, connectFresh, disconnect, request } = require('./helpers');

// A low auth limit so the 4th request in the window is rejected.
const { app, connectDB } = loadApp({ RATE_LIMIT_AUTH_MAX: '3' });

beforeAll(() => connectFresh(connectDB));
afterAll(disconnect);

test('auth endpoints return 429 RATE_LIMITED past the limit', async () => {
  const attempt = () => request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Wrong1234' });
  for (let i = 0; i < 3; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    expect((await attempt()).status).toBe(401);
  }
  const limited = await attempt();
  expect(limited.status).toBe(429);
  expect(limited.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  expect(limited.headers['retry-after']).toBeDefined();

  // Non-auth endpoints are not affected by the auth limiter.
  expect((await request(app).get('/api/health')).status).toBe(200);
});

test('every response carries an x-request-id', async () => {
  const res = await request(app).get('/api/health').set('x-request-id', 'abc-123');
  expect(res.headers['x-request-id']).toBe('abc-123');
  const generated = await request(app).get('/api/ready');
  expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  expect(generated.body.status).toBe('ready');
});

test('API responses are not cacheable and carry no ETag', async () => {
  const res = await request(app).get('/api/health');
  expect(res.headers['cache-control']).toBe('no-store');
  expect(res.headers.etag).toBeUndefined();
});

test('unknown API routes return the JSON error shape', async () => {
  const res = await request(app).get('/api/does-not-exist');
  expect(res.status).toBe(404);
  expect(res.body.error.code).toBe('NOT_FOUND');
});
