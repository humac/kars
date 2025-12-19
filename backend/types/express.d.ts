/**
 * Express type extensions for authenticated requests
 */

import { Request } from 'express';

declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
      role: 'employee' | 'manager' | 'admin' | 'attestation_coordinator';
      first_name?: string;
      last_name?: string;
    }

    interface Request {
      user?: User;
      file?: {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      };
      asset?: import('./database').Asset;
    }
  }
}

export {};
