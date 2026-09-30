const request = require('supertest');
const app = require('../service');
const { DB, Role } = require('../database/database');

let dinerToken;
let adminToken;
let menuItem;

beforeAll(async () => {
    const dinerEmail =
        Math.random().toString(36).substring(2, 12) + '@test.com';

    const adminEmail =
        Math.random().toString(36).substring(2, 12) + '@test.com';

    // Create normal diner
    const dinerRes = await request(app)
        .post('/api/auth')
        .send({ name: 'order test diner', email: dinerEmail, password: 'password', });

    dinerToken = dinerRes.body.token;
    // Create an admin directly in the database
    await DB.addUser({ name: 'order test admin', email: adminEmail, password: 'password', roles: [{ role: Role.Admin }], });
    // Login as admin
    const adminRes = await request(app)
        .put('/api/auth')
        .send({
            email: adminEmail,
            password: 'password',
        });

    adminToken = adminRes.body.token;
});

test('get menu', async () => {
    const res = await request(app)
        .get('/api/order/menu');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
});

test('cannot add menu item without authentication', async () => {
    const res = await request(app)
        .put('/api/order/menu')
        .send({ title: 'Test Pizza', description: 'Pizza for testing', image: 'test.png', price: 0.01, });
    expect(res.status).toBe(401);
});

test('diner cannot add menu item', async () => {
    const res = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${dinerToken}`)
        .send({ title: 'Test Pizza', description: 'Pizza for testing', image: 'test.png', price: 0.01, });

    expect(res.status).toBe(403);

    expect(res.body).toMatchObject({ message: 'unable to add menu item', });
});

test('admin can add menu item', async () => {
    const title =
        'Test Pizza ' + Math.random().toString(36).substring(2, 8);

    const res = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title, description: 'Pizza for testing', image: 'test.png', price: 0.01, });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    menuItem = res.body.find((item) => item.title === title);
    expect(menuItem).toBeDefined();
    expect(menuItem.description).toBe('Pizza for testing');
});

test('cannot get orders without authentication', async () => {
    const res = await request(app)
        .get('/api/order');
    expect(res.status).toBe(401);
});

test('get orders for authenticated user', async () => {
    const res = await request(app)
        .get('/api/order')
        .set('Authorization', `Bearer ${dinerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('dinerId');
    expect(res.body).toHaveProperty('orders');
    expect(res.body).toHaveProperty('page');
    expect(Array.isArray(res.body.orders)).toBe(true);
});

test('create order', async () => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            reportUrl: 'https://example.com/report', jwt: 'factory-test-jwt',
        }),
    });

    const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${dinerToken}`)
        .send({ franchiseId: 1, storeId: 1, items: [{ menuId: menuItem.id, description: menuItem.title, price: Number(menuItem.price), },], });
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({
        franchiseId: 1,
        storeId: 1,
    });

    expect(res.body.order.id).toBeDefined();

    expect(res.body).toMatchObject({
        followLinkToEndChaos: 'https://example.com/report',
        jwt: 'factory-test-jwt',
    });

    expect(global.fetch).toHaveBeenCalled();
});

test('factory failure returns 500', async () => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
            reportUrl: 'https://example.com/failure',
        }),
    });

    const res = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${dinerToken}`)
        .send({
            franchiseId: 1,
            storeId: 1,
            items: [{ menuId: menuItem.id, description: menuItem.title, price: Number(menuItem.price), },],
        });
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
        message: 'Failed to fulfill order at factory',
        followLinkToEndChaos: 'https://example.com/failure',
    });
});