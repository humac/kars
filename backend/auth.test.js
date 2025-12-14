import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { generateToken, verifyToken, hashPassword, comparePassword, authenticate, authorize, optionalAuth } from './auth.js';

describe('Auth Module', () => {
  describe('JWT_SECRET validation', () => {
    it('should allow missing JWT_SECRET in non-production environments', () => {
      // When NODE_ENV is not production, missing JWT_SECRET should be allowed
      // This is validated by the fact that the module loads successfully in test mode
      // and uses the fallback value
      const testEnv = process.env.NODE_ENV;
      expect(['test', 'development', undefined]).toContain(testEnv);
      
      // Module loaded successfully without throwing error
      expect(generateToken).toBeDefined();
      expect(verifyToken).toBeDefined();
    });

    // Note: Testing the production failure case (NODE_ENV=production without JWT_SECRET)
    // requires dynamic import in a separate process, which is complex with ES modules and Jest.
    // The validation is in place at lines 6-8 of auth.js:
    //   if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    //     throw new Error('JWT_SECRET must be set in production');
    //   }
    // This will throw an error at module load time if the conditions are met.
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include user data in token payload', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
      };

      const token = generateToken(user);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.name).toBe(user.name);
      expect(decoded.role).toBe(user.role);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      };

      const token = generateToken(user);
      const decoded = verifyToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(user.id);
    });

    it('should return null for an invalid token', () => {
      const decoded = verifyToken('invalid-token');
      expect(decoded).toBeNull();
    });

    it('should return null for an empty token', () => {
      const decoded = verifyToken('');
      expect(decoded).toBeNull();
    });
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password and hash', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);
      const isMatch = await comparePassword(password, hash);

      expect(isMatch).toBe(true);
    });

    it('should return false for non-matching password and hash', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword';
      const hash = await hashPassword(password);
      const isMatch = await comparePassword(wrongPassword, hash);

      expect(isMatch).toBe(false);
    });

    it('should return false for invalid hash', async () => {
      const password = 'testPassword123';
      const isMatch = await comparePassword(password, 'invalid-hash');

      expect(isMatch).toBe(false);
    });
  });

  describe('optionalAuth middleware', () => {
    let req, res, next, consoleErrorSpy;

    beforeEach(() => {
      // Reset request/response/next mocks
      req = {
        headers: {}
      };
      res = {};
      next = jest.fn();
      
      // Spy on console.error
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });

    it('should call next() when no auth header is present', () => {
      optionalAuth(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should attach user when valid token is provided', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user'
      };
      
      const token = generateToken(user);
      req.headers.authorization = `Bearer ${token}`;
      
      optionalAuth(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeDefined();
      expect(req.user.email).toBe(user.email);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should not attach user when invalid token is provided', () => {
      req.headers.authorization = 'Bearer invalid-token';
      
      optionalAuth(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log error and call next() when an exception occurs', () => {
      // Create a scenario where an error would be thrown
      // by providing malformed authorization header that causes substring to fail
      Object.defineProperty(req.headers, 'authorization', {
        get: () => {
          throw new Error('Unexpected error in header processing');
        }
      });
      
      optionalAuth(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Optional authentication error:',
        expect.any(Error)
      );
    });

    it('should not throw error when malformed Bearer token format', () => {
      req.headers.authorization = 'Bearer ';
      
      optionalAuth(req, res, next);
      
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('authenticate middleware', () => {
    let req, res, next, jsonMock, statusMock;

    beforeEach(() => {
      jsonMock = jest.fn();
      statusMock = jest.fn(() => ({ json: jsonMock }));
      req = {
        headers: {}
      };
      res = {
        status: statusMock,
        json: jsonMock
      };
      next = jest.fn();
    });

    it('should return 401 when no authorization header is present', () => {
      authenticate(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header does not start with Bearer', () => {
      req.headers.authorization = 'Basic sometoken';

      authenticate(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', () => {
      req.headers.authorization = 'Bearer invalid-token';

      authenticate(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should attach user to request and call next() when token is valid', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin'
      };

      const token = generateToken(user);
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(user.id);
      expect(req.user.email).toBe(user.email);
      expect(req.user.role).toBe(user.role);
      expect(next).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('authorize middleware', () => {
    let req, res, next, jsonMock, statusMock;

    beforeEach(() => {
      jsonMock = jest.fn();
      statusMock = jest.fn(() => ({ json: jsonMock }));
      req = {
        user: null
      };
      res = {
        status: statusMock,
        json: jsonMock
      };
      next = jest.fn();
    });

    it('should return 401 when user is not authenticated', () => {
      const middleware = authorize('admin');
      middleware(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Not authenticated' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow access when user has the required role', () => {
      req.user = { id: 1, email: 'admin@example.com', role: 'admin' };
      const middleware = authorize('admin');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 403 when user role is not in allowed roles', () => {
      req.user = { id: 1, email: 'user@example.com', role: 'employee' };
      const middleware = authorize('admin');
      middleware(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow access when user has one of multiple allowed roles (admin)', () => {
      req.user = { id: 1, email: 'admin@example.com', role: 'admin' };
      const middleware = authorize('admin', 'manager');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow access when user has one of multiple allowed roles (manager)', () => {
      req.user = { id: 2, email: 'manager@example.com', role: 'manager' };
      const middleware = authorize('admin', 'manager');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 403 when user role is not in multiple allowed roles', () => {
      req.user = { id: 3, email: 'employee@example.com', role: 'employee' };
      const middleware = authorize('admin', 'manager');
      middleware(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should perform case-insensitive role matching (lowercase user role)', () => {
      req.user = { id: 1, email: 'admin@example.com', role: 'admin' };
      const middleware = authorize('Admin', 'Manager');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should perform case-insensitive role matching (uppercase user role)', () => {
      req.user = { id: 1, email: 'admin@example.com', role: 'ADMIN' };
      const middleware = authorize('admin', 'manager');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should perform case-insensitive role matching (mixed case)', () => {
      req.user = { id: 2, email: 'manager@example.com', role: 'Manager' };
      const middleware = authorize('admin', 'manager');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should reject manager when only admin is allowed', () => {
      req.user = { id: 2, email: 'manager@example.com', role: 'manager' };
      const middleware = authorize('admin');
      middleware(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user has no role defined', () => {
      req.user = { id: 4, email: 'norole@example.com' };
      const middleware = authorize('admin');
      middleware(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user role is null', () => {
      req.user = { id: 4, email: 'norole@example.com', role: null };
      const middleware = authorize('admin');
      middleware(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
