import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
import type { Request, Response } from 'express';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

interface UserRow extends RowDataPacket {
  id: number;
  full_name: string;
  username: string;
  password_hash: string;
  role: string;
  customer_code: string | null;
  active: number;
}

interface CountRow extends RowDataPacket {
  n: number;
  customer_count: number;
}

interface TokenUser {
  id: number;
  full_name: string;
  username: string;
  role: string;
  customer_code?: string | null;
}

const tokenFor = (u: TokenUser) =>
  jwt.sign(
    {
      id: u.id,
      name: u.full_name,
      username: u.username,
      role: u.role,
      customer_code: u.customer_code
    },
    process.env.JWT_SECRET || 'dev-secret-change-me',
    { expiresIn: '8h' }
  );

// ==========================
// ADMIN SETUP
// ==========================
export async function setupAdmin(req: Request, res: Response) {
  try {
    const [existing] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS n FROM users WHERE role='admin'"
    );

    if (existing[0].n > 0) {
      return res.status(409).json({
        message: 'Admin account already exists. Admin setup is allowed only once.'
      });
    }

    const { full_name, username, password } = req.body;

    if (!full_name || !username || !password || password.length < 8) {
      return res.status(400).json({
        message: 'Name, username, and password (8+ characters) are required.'
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO users(full_name, username, password_hash, role)
       VALUES(?,?,?,'admin')`,
      [full_name, username, hash]
    );

    const u: TokenUser = {
      id: result.insertId,
      full_name,
      username,
      role: 'admin'
    };

    return res.status(201).json({
      token: tokenFor(u),
      user: u
    });
  } catch (e: any) {
    return res.status(500).json({
      message: e.code === 'ER_DUP_ENTRY'
        ? 'Username already exists'
        : 'Admin setup failed'
    });
  }
}

// ==========================
// CUSTOMER REGISTRATION
// ==========================
export async function registerCustomer(req: Request, res: Response) {
  try {
    const { full_name, username, password } = req.body;

    if (!full_name || !username || !password || password.length < 6) {
      return res.status(400).json({
        message: 'Complete all fields. Password must be at least 6 characters.'
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const [countRows] = await conn.query<CountRow[]>(
        "SELECT COUNT(*) AS customer_count FROM users WHERE role='customer'"
      );

      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO users(full_name, username, password_hash, role)
         VALUES(?,?,?,'customer')`,
        [full_name, username, hash]
      );

      const code = `CUSTOMER-${String(
        Number(countRows[0].customer_count) + 1
      ).padStart(2, '0')}`;

      await conn.query(
        'UPDATE users SET customer_code=? WHERE id=?',
        [code, result.insertId]
      );

      await conn.commit();

      const u: TokenUser = {
        id: result.insertId,
        full_name,
        username,
        role: 'customer',
        customer_code: code
      };

      return res.status(201).json({
        token: tokenFor(u),
        user: u
      });
    } catch (e: any) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e: any) {
    return res.status(500).json({
      message: e.code === 'ER_DUP_ENTRY'
        ? 'Username already exists'
        : 'Registration failed'
    });
  }
}

// ==========================
// LOGIN
// ==========================
export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;

    const [rows] = await pool.query<UserRow[]>(
      'SELECT * FROM users WHERE username=? AND active=1',
      [username]
    );

    if (
      !rows.length ||
      !(await bcrypt.compare(password, rows[0].password_hash))
    ) {
      return res.status(401).json({
        message: 'Invalid username or password'
      });
    }

    const u = rows[0];

    const user: TokenUser = {
      id: u.id,
      full_name: u.full_name,
      username: u.username,
      role: u.role,
      customer_code: u.customer_code
    };

    return res.json({
      token: tokenFor(user),
      user
    });
  } catch {
    return res.status(500).json({
      message: 'Login error'
    });
  }
}

// ==========================
// CURRENT USER
// ==========================
export async function me(req: Request, res: Response) {
  return res.json(req.user);
}
