import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'mneme-jwt-secret-change-in-production';

/**
 * Generate JWT token for a user
 */
export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

/**
 * Verify JWT token and return payload
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Authentication middleware
 * Extracts JWT from Authorization header and attaches user to request
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Authorization header with Bearer token is required',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token is invalid or expired',
      });
    }

    const user = await User.findById(payload.userId);

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'Account no longer exists',
      });
    }

    // Attach user to request
    req.user = user;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication',
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user to request if valid token is provided, but doesn't require it
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const payload = verifyToken(token);
        const user = await User.findById(payload.userId);

        if (user) {
          req.user = user;
        }
      } catch {
        // Invalid token - continue without auth
      }
    }

    next();
  } catch (error) {
    // Continue without auth on error
    next();
  }
}
