import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'http';
import { createApp } from '../../src/app';
import { signToken } from '../../src/lib/auth/jwt';

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

describe('Journal v1 Contract (Diary/Reflection)', () => {
  let server: Server;
  let baseUrl: string;
  let authHeader: string;

  beforeAll(async () => {
    const app = createApp();
    server = createServer((req, res) => app.handle(req, res));

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('Failed to bind test server');
    baseUrl = `http://127.0.0.1:${addr.port}`;

    // Provide a valid JWT for protected endpoints.
    authHeader = `Bearer ${signToken({ userId: 'test-user-contract', tier: 'pro' })}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('POST /api/journal is idempotent by Idempotency-Key', async () => {
    const key = 'idem-test-key-1';
    const payload = { summary: 'Hello diary' };

    const res1 = await fetch(`${baseUrl}/api/journal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });
    const body1 = await readJson(res1);

    expect(res1.status).toBe(201);
    expect(body1).toHaveProperty('status', 'ok');
    expect(body1).toHaveProperty('data');
    expect(body1.data).toHaveProperty('id');
    expect(body1.data).toHaveProperty('status', 'pending');
    expect(body1.data).toHaveProperty('createdAt');
    expect(body1.data).toHaveProperty('updatedAt');
    expect(body1.data).toHaveProperty('summary', 'Hello diary');
    expect(body1.data).not.toHaveProperty('side');
    expect(body1.data).not.toHaveProperty('confirmData');
    expect(body1.data).not.toHaveProperty('archiveData');

    const res2 = await fetch(`${baseUrl}/api/journal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });
    const body2 = await readJson(res2);

    expect(res2.status).toBe(201);
    expect(body2).toHaveProperty('status', 'ok');
    expect(body2).toHaveProperty('data');
    expect(body2.data.id).toBe(body1.data.id);

    const listRes = await fetch(`${baseUrl}/api/journal`, {
      headers: { Authorization: authHeader },
    });
    const listBody = await readJson(listRes);

    expect(listRes.status).toBe(200);
    expect(listBody).toHaveProperty('status', 'ok');
    expect(listBody).toHaveProperty('data');
    expect(listBody.data).toHaveProperty('items');
    expect(Array.isArray(listBody.data.items)).toBe(true);
    expect(listBody.data.items.length).toBe(1);
    expect(listBody.data.items[0].id).toBe(body1.data.id);
  });

  it('confirm/archive/restore accept empty bodies and follow timestamp rules', async () => {
    const createRes = await fetch(`${baseUrl}/api/journal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-test-key-2',
        Authorization: authHeader,
      },
      body: JSON.stringify({ summary: 'Entry for transitions' }),
    });
    const created = await readJson(createRes);
    expect(createRes.status).toBe(201);
    expect(created).toHaveProperty('status', 'ok');
    const id = created.data.id as string;

    const confirmRes = await fetch(`${baseUrl}/api/journal/${id}/confirm`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    });
    const confirmBody = await readJson(confirmRes);
    expect(confirmRes.status).toBe(200);
    expect(confirmBody).toHaveProperty('status', 'ok');
    expect(confirmBody).toHaveProperty('data');
    expect(confirmBody.data).toHaveProperty('status', 'confirmed');
    expect(confirmBody.data).toHaveProperty('confirmedAt');
    expect(confirmBody.data).not.toHaveProperty('archivedAt');

    const archiveRes = await fetch(`${baseUrl}/api/journal/${id}/archive`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    });
    const archiveBody = await readJson(archiveRes);
    expect(archiveRes.status).toBe(200);
    expect(archiveBody).toHaveProperty('status', 'ok');
    expect(archiveBody.data).toHaveProperty('status', 'archived');
    expect(archiveBody.data).toHaveProperty('archivedAt');
    // confirmedAt must only exist when status === "confirmed"
    expect(archiveBody.data).not.toHaveProperty('confirmedAt');

    const restoreRes = await fetch(`${baseUrl}/api/journal/${id}/restore`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    });
    const restoreBody = await readJson(restoreRes);
    expect(restoreRes.status).toBe(200);
    expect(restoreBody).toHaveProperty('status', 'ok');
    // Restore of user_action archive defaults to confirmed (matched_sell restores to pending).
    expect(restoreBody.data).toHaveProperty('status', 'confirmed');
    expect(restoreBody.data).not.toHaveProperty('archivedAt');
    expect(restoreBody.data).toHaveProperty('confirmedAt');
  });

  it('invalid transitions return 409 INVALID_TRANSITION', async () => {
    // confirm after archive => invalid
    const createRes = await fetch(`${baseUrl}/api/journal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-test-key-3',
        Authorization: authHeader,
      },
      body: JSON.stringify({ summary: 'Invalid transition test' }),
    });
    const created = await readJson(createRes);
    const id = created.data.id as string;

    // Confirm first; user archive of pending is invalid.
    await fetch(`${baseUrl}/api/journal/${id}/confirm`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    });
    await fetch(`${baseUrl}/api/journal/${id}/archive`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    });

    const badConfirmRes = await fetch(`${baseUrl}/api/journal/${id}/confirm`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    });
    const badConfirmBody = await readJson(badConfirmRes);
    expect(badConfirmRes.status).toBe(409);
    expect(badConfirmBody).toHaveProperty('error');
    expect(badConfirmBody.error).toHaveProperty('code', 'INVALID_TRANSITION');

    // restore on confirmed => invalid
    const createRes2 = await fetch(`${baseUrl}/api/journal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-test-key-4',
        Authorization: authHeader,
      },
      body: JSON.stringify({ summary: 'Invalid restore test' }),
    });
    const created2 = await readJson(createRes2);
    const id2 = created2.data.id as string;

    await fetch(`${baseUrl}/api/journal/${id2}/confirm`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    });
    const badRestoreRes = await fetch(`${baseUrl}/api/journal/${id2}/restore`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    });
    const badRestoreBody = await readJson(badRestoreRes);
    expect(badRestoreRes.status).toBe(409);
    expect(badRestoreBody).toHaveProperty('error');
    expect(badRestoreBody.error).toHaveProperty('code', 'INVALID_TRANSITION');
  });
});

