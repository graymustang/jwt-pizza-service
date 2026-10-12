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

test('list users unauthorized', async () => {
    const listUsersRes = await request(app).get('/api/user');
    expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
    const [user, userToken] = await registerUser(request(app));
    const listUsersRes = await request(app)
        .get('/api/user')
        .set('Authorization', 'Bearer ' + userToken);
    expect(listUsersRes.status).toBe(200);
});

async function registerUser(service) {
    const testUser = {
        name: 'pizza diner',
        email: `${randomName()}@test.com`,
        password: 'a',
    };
    const registerRes = await service.post('/api/auth').send(testUser);
    registerRes.body.user.password = testUser.password;

    return [registerRes.body.user, registerRes.body.token];
}

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}