const request = require('supertest');
const app = require('../service');

const testUser = {
    name: 'user test',
    email: '',
    password: 'password',
};
let authToken;
let userId;

beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';

    const registerRes = await request(app)
        .post('/api/auth')
        .send(testUser);
    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;
});

test('get current user', async () => {
    const res = await request(app)
        .get('/api/user/me')
        .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
        id: userId,
        name: testUser.name,
        email: testUser.email,
    });
});

test('get current user without authentication', async () => {
    const res = await request(app)
        .get('/api/user/me');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ message: 'unauthorized', });
});

test('update user', async () => {
    const updatedName = 'updated user';

    const res = await request(app)
        .put(`/api/user/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: updatedName, email: testUser.email, password: testUser.password, });

    expect(res.status).toBe(200);

    expect(res.body.user).toMatchObject({
        id: userId,
        name: updatedName,
        email: testUser.email,
    });

    expect(res.body.token).toBeDefined();
    authToken = res.body.token;
});

test('delete user returns not implemented', async () => {
    const res = await request(app)
        .delete(`/api/user/${userId}`)
        .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'not implemented', });
});

test('list users returns not implemented', async () => {
    const res = await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);

    expect(res.body).toMatchObject({ message: 'not implemented', users: [], more: false, });
});