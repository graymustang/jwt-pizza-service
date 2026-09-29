const request = require('supertest');
const app = require('../service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: 'diner' }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

test('register needs name, email, and password', async () => {
    const registerRes = await request(app)
    .post('/api/auth')
    .send({name: 'pizza diner', email: randomName() + '@test.com',});

    expect(registerRes.status).toBe(400);
    expect(registerRes.body).toMatchObject({message: 
        'name, email, and password are required',
    });
});

test('no authentication', async () => {
    const logoutRes = await request(app).delete('/api/auth');
    expect(logoutRes.status).toBe(401);
    expect(logoutRes.body).toMatchObject({message: 'unauthorized',});
});

test('logout', async () => {
    const logoutRes = await (request(app).delete('/api/auth')).set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toMatchObject({message: 'logout successful'});
});

function randomName() {
    return Math.random().toString(36).substring(2,12);
}