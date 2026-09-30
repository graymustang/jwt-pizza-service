const request = require('supertest');
const app = require('../service');
const { DB, Role } = require('../database/database');

let adminToken;
let franchiseeToken;
let dinerToken;
let franchiseeId;
let franchiseeEmail;
let franchiseId;

beforeAll(async () => {
    const random = Math.random().toString(36).substring(2, 10);

    const adminEmail = `admin-${random}@test.com`;
    franchiseeEmail = `franchisee-${random}@test.com`;
    const dinerEmail = `diner-${random}@test.com`;

    //Create admin directly in databse
    await DB.addUser({ name: 'franchise test admin', email: adminEmail, password: 'password', roles: [{ role: Role.Admin }], });

    const adminLogin = await request(app)
        .put('/api/auth')
        .send({ email: adminEmail, password: 'password', });

    adminToken = adminLogin.body.token;

    // reate franchisee user normally
    const franchiseeRes = await request(app)
        .post('/api/auth')
        .send({ name: 'franchise test franchisee', email: franchiseeEmail, password: 'password', });

    franchiseeToken = franchiseeRes.body.token;
    franchiseeId = franchiseeRes.body.user.id;
    //Create normal diner
    const dinerRes = await request(app)
        .post('/api/auth')
        .send({ name: 'franchise test diner', email: dinerEmail, password: 'password', });

    dinerToken = dinerRes.body.token;
});
test('get franchises', async () => {
    const res = await request(app)
        .get('/api/franchise');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('franchises');
    expect(res.body).toHaveProperty('more');
    expect(Array.isArray(res.body.franchises)).toBe(true);
});
test('diner cannot create franchise', async () => {
    const res = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${dinerToken}`)
        .send({ name: 'Unauthorized Franchise', admins: [], });

    expect(res.status).toBe(403);

    expect(res.body).toMatchObject({
        message: 'unable to create a franchise',
    });
});

test('admin cannot create franchise with unknown user', async () => {
    const res = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
            name: 'REALLY Bad Franchise', admins: [{ email: 'does-not-exist@test.com', },],
        });

    expect(res.status).toBe(404);
});

test('admin can create franchise', async () => {
    const res = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: `Test Franchise ${Date.now()}`, admins: [{ email: franchiseeEmail, },], });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.admins.length).toBe(1);

    franchiseId = res.body.id;
});

test('user can get their own franchises', async () => {
    const res = await request(app)
        .get(`/api/franchise/${franchiseeId}`)
        .set('Authorization', `Bearer ${franchiseeToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    expect(
        res.body.some((franchise) => franchise.id === franchiseId)
    ).toBe(true);
});

