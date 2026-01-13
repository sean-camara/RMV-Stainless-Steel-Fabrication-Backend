const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');

class TokenService {
  /**
   * Generate access token
   */
  generateAccessToken(userId, role) {
    return jwt.sign(
      { userId, role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId) {
    return jwt.sign(
      { userId, type: 'refresh' },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
  }

  /**
   * Generate both tokens
   */
  generateTokens(userId, role) {
    return {
      accessToken: this.generateAccessToken(userId, role),
      refreshToken: this.generateRefreshToken(userId),
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret);
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cleanup expired and excess refresh tokens for a user
   * Removes tokens older than 30 days and caps list to 10 most recent
   * @param {string} userId - User ID to cleanup tokens for
   * @returns {Promise<void>}
   */
  async cleanupExpiredTokens(userId) {
    const user = await User.findById(userId);
    if (!user) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    user.refreshTokens = user.refreshTokens.filter((token) => token.createdAt > cutoffDate);

    if (user.refreshTokens.length > 10) {
      user.refreshTokens = user.refreshTokens
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10);
    }

    await user.save();
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token) {
    return jwt.decode(token);
  }

  /**
   * Get expiry time for a token
   */
  getTokenExpiry(token) {
    const decoded = jwt.decode(token);
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  }
}

module.exports = new TokenService();
