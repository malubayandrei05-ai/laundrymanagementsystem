import type { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: (JwtPayload & {
        id: number;
        name?: string;
        username?: string;
        role: 'admin' | 'staff' | 'customer';
        customer_code?: string;
      }) | undefined;
    }
  }
}

export {};
