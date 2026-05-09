import { randomUUID } from 'crypto';
import { getDatabase } from '../../db/index.js';

export interface AuthUserRecord {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  created_at: string;
  last_login_at: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findAuthUserByEmail(email: string): Promise<AuthUserRecord | null> {
  const db = getDatabase();
  const normalized = normalizeEmail(email);
  const row = await db
    .prepare(
      `SELECT id, email, username, password_hash, created_at, last_login_at
       FROM auth_users_v1
       WHERE email = ?`
    )
    .get<AuthUserRecord>(normalized);

  return row || null;
}

export async function findAuthUserById(userId: string): Promise<AuthUserRecord | null> {
  const db = getDatabase();
  const row = await db
    .prepare(
      `SELECT id, email, username, password_hash, created_at, last_login_at
       FROM auth_users_v1
       WHERE id = ?`
    )
    .get<AuthUserRecord>(userId);

  return row || null;
}

export async function createAuthUser(input: {
  email: string;
  username: string;
  passwordHash: string;
}): Promise<AuthUserRecord> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const row: AuthUserRecord = {
    id: `user-${randomUUID()}`,
    email: normalizeEmail(input.email),
    username: input.username.trim(),
    password_hash: input.passwordHash,
    created_at: now,
    last_login_at: now,
  };

  await db
    .prepare(
      `INSERT INTO auth_users_v1 (id, email, username, password_hash, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(row.id, row.email, row.username, row.password_hash, row.created_at, row.last_login_at);

  return row;
}

export async function touchAuthUserLastLogin(userId: string): Promise<void> {
  const db = getDatabase();
  await db
    .prepare(`UPDATE auth_users_v1 SET last_login_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), userId);
}
