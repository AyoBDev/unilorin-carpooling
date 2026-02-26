/**
 * Encryption Utility
 * University of Ilorin Carpooling Platform
 *
 * Provides bcrypt password hashing, crypto utilities,
 * secure token generation, and encryption helpers.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Configuration
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars!'; // Must be 32 bytes for AES-256
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Password Hashing with Bcrypt
 */
const password = {
  /**
   * Hash a password using bcrypt
   * @param {string} plainPassword - The plain text password
   * @param {number} rounds - Number of salt rounds (default: 12)
   * @returns {Promise<string>} Hashed password
   */
  async hash(plainPassword, rounds = BCRYPT_ROUNDS) {
    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new Error('Password must be a non-empty string');
    }

    if (plainPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    return bcrypt.hash(plainPassword, rounds);
  },

  /**
   * Compare a plain password with a hashed password
   * @param {string} plainPassword - The plain text password
   * @param {string} hashedPassword - The hashed password
   * @returns {Promise<boolean>} True if passwords match
   */
  async compare(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) {
      return false;
    }

    return bcrypt.compare(plainPassword, hashedPassword);
  },

  /**
   * Check if a password needs rehashing (e.g., if rounds changed)
   * @param {string} hashedPassword - The hashed password
   * @param {number} rounds - Expected number of rounds
   * @returns {boolean} True if password needs rehashing
   */
  needsRehash(hashedPassword, rounds = BCRYPT_ROUNDS) {
    if (!hashedPassword) {
      return true;
    }

    const hashRounds = bcrypt.getRounds(hashedPassword);
    return hashRounds < rounds;
  },

  /**
   * Validate password strength
   * @param {string} plainPassword - The password to validate
   * @returns {Object} Validation result with isValid and errors
   */
  validateStrength(plainPassword) {
    const errors = [];

    if (!plainPassword || typeof plainPassword !== 'string') {
      return { isValid: false, errors: ['Password is required'] };
    }

    if (plainPassword.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (plainPassword.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    if (!/[a-z]/.test(plainPassword)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(plainPassword)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(plainPassword)) {
      errors.push('Password must contain at least one digit');
    }

    // Optional: Check for special characters
    // if (!/[!@#$%^&*(),.?":{}|<>]/.test(plainPassword)) {
    //   errors.push('Password must contain at least one special character');
    // }

    return {
      isValid: errors.length === 0,
      errors,
      strength: this._calculateStrength(plainPassword),
    };
  },

  /**
   * Calculate password strength score (0-100)
   * @private
   */
  _calculateStrength(plainPassword) {
    if (!plainPassword) return 0;

    let score = 0;
    const { length } = plainPassword;

    // Length contribution (up to 30 points)
    score += Math.min(length * 2, 30);

    // Character variety (up to 40 points)
    if (/[a-z]/.test(plainPassword)) score += 10;
    if (/[A-Z]/.test(plainPassword)) score += 10;
    if (/[0-9]/.test(plainPassword)) score += 10;
    if (/[^a-zA-Z0-9]/.test(plainPassword)) score += 10;

    // Bonus for mixing (up to 30 points)
    const varietyCount = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((regex) =>
      regex.test(plainPassword),
    ).length;

    score += varietyCount * 7.5;

    return Math.min(Math.round(score), 100);
  },
};

/**
 * Token Generation
 */
const tokens = {
  /**
   * Generate a secure random token
   * @param {number} length - Length of the token in bytes (default: 32)
   * @returns {string} Hex-encoded random token
   */
  generateSecure(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  },

  /**
   * Generate a URL-safe token
   * @param {number} length - Length of the token in bytes (default: 32)
   * @returns {string} URL-safe base64 encoded token
   */
  generateUrlSafe(length = 32) {
    return crypto.randomBytes(length).toString('base64url');
  },

  /**
   * Generate a numeric OTP
   * @param {number} digits - Number of digits (default: 6)
   * @returns {string} Numeric OTP
   */
  generateOTP(digits = 6) {
    const max = 10 ** digits;
    const min = 10 ** (digits - 1);
    const randomNumber = crypto.randomInt(min, max);
    return randomNumber.toString();
  },

  /**
   * Generate a verification code (alphanumeric)
   * @param {number} length - Length of the code (default: 8)
   * @returns {string} Alphanumeric verification code
   */
  generateVerificationCode(length = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar looking characters
    let code = '';
    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i += 1) {
      const [byte] = [randomBytes[i]];
      code += chars[byte % chars.length];
    }

    return code;
  },

  /**
   * Generate a booking reference code
   * Format: BK-XXXXXX (6 alphanumeric characters)
   * @returns {string} Booking reference
   */
  generateBookingReference() {
    return `BK-${this.generateVerificationCode(6)}`;
  },

  /**
   * Generate a ride offer code
   * Format: RD-XXXXXX (6 alphanumeric characters)
   * @returns {string} Ride offer reference
   */
  generateRideReference() {
    return `RD-${this.generateVerificationCode(6)}`;
  },

  /**
   * Generate a transaction reference
   * Format: TXN-TIMESTAMP-RANDOM
   * @returns {string} Transaction reference
   */
  generateTransactionReference() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = this.generateVerificationCode(6);
    return `TXN-${timestamp}-${random}`;
  },

  /**
   * Generate a unique passenger verification code for ride
   * 4-digit code that passenger shows driver
   * @returns {string} 4-digit verification code
   */
  generatePassengerCode() {
    return this.generateOTP(4);
  },
};

/**
 * AES-256 Encryption/Decryption
 */
const aes = {
  /**
   * Encrypt data using AES-256-CBC
   * @param {string} text - Plain text to encrypt
   * @param {string} key - Encryption key (32 bytes)
   * @returns {string} Encrypted string (iv:encrypted)
   */
  encrypt(text, key = ENCRYPTION_KEY) {
    if (!text) return null;

    // Ensure key is 32 bytes
    const keyBuffer = Buffer.from(key.padEnd(32, '0').slice(0, 32));
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
  },

  /**
   * Decrypt AES-256-CBC encrypted data
   * @param {string} encryptedText - Encrypted string (iv:encrypted)
   * @param {string} key - Encryption key (32 bytes)
   * @returns {string} Decrypted plain text
   */
  decrypt(encryptedText, key = ENCRYPTION_KEY) {
    if (!encryptedText) return null;

    try {
      const keyBuffer = Buffer.from(key.padEnd(32, '0').slice(0, 32));
      const [ivHex, encrypted] = encryptedText.split(':');

      if (!ivHex || !encrypted) {
        throw new Error('Invalid encrypted text format');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed: Invalid encrypted data or key');
    }
  },
};

/**
 * Hashing Utilities
 */
const hashing = {
  /**
   * Create SHA-256 hash
   * @param {string} data - Data to hash
   * @returns {string} Hex-encoded hash
   */
  sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  },

  /**
   * Create SHA-512 hash
   * @param {string} data - Data to hash
   * @returns {string} Hex-encoded hash
   */
  sha512(data) {
    return crypto.createHash('sha512').update(data).digest('hex');
  },

  /**
   * Create HMAC-SHA256
   * @param {string} data - Data to hash
   * @param {string} secret - Secret key
   * @returns {string} Hex-encoded HMAC
   */
  hmacSha256(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  },

  /**
   * Create MD5 hash (not for security, only for checksums)
   * @param {string} data - Data to hash
   * @returns {string} Hex-encoded hash
   */
  md5(data) {
    return crypto.createHash('md5').update(data).digest('hex');
  },

  /**
   * Verify Paystack webhook signature
   * @param {string} payload - Request body as string
   * @param {string} signature - Signature from header
   * @param {string} secret - Paystack secret key
   * @returns {boolean} True if signature is valid
   */
  verifyPaystackSignature(payload, signature, secret) {
    const hash = this.hmacSha256(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  },
};

/**
 * Data Masking Utilities
 */
const masking = {
  /**
   * Mask email address
   * @param {string} email - Email to mask
   * @returns {string} Masked email (e.g., j***@example.com)
   */
  maskEmail(email) {
    if (!email || !email.includes('@')) return '***@***.***';

    const [local, domain] = email.split('@');
    const [firstChar] = local;
    const maskedLocal = local.length > 2 ? `${firstChar}${'*'.repeat(local.length - 1)}` : '***';

    return `${maskedLocal}@${domain}`;
  },

  /**
   * Mask phone number
   * @param {string} phone - Phone number to mask
   * @returns {string} Masked phone (e.g., ***-***-1234)
   */
  maskPhone(phone) {
    if (!phone || phone.length < 4) return '***-***-****';

    const lastFour = phone.slice(-4);
    return `***-***-${lastFour}`;
  },

  /**
   * Mask matric number
   * @param {string} matricNumber - Matric number to mask
   * @returns {string} Masked matric number (e.g., 19/55**
   */
  maskMatricNumber(matricNumber) {
    if (!matricNumber || matricNumber.length < 4) return '**/*****/**';

    const parts = matricNumber.split('/');
    if (parts.length === 3) {
      const [part0, part1, part2] = parts;
      return `${part0}/${part1.slice(0, 2)}**/${part2.slice(0, 1)}**`;
    }

    return matricNumber.slice(0, 4) + '*'.repeat(matricNumber.length - 4);
  },

  /**
   * Mask credit card number
   * @param {string} cardNumber - Card number to mask
   * @returns {string} Masked card (e.g., ****-****-****-1234)
   */
  maskCreditCard(cardNumber) {
    if (!cardNumber || cardNumber.length < 4) return '****-****-****-****';

    const cleaned = cardNumber.replace(/\D/g, '');
    const lastFour = cleaned.slice(-4);

    return `****-****-****-${lastFour}`;
  },

  /**
   * Mask sensitive fields in an object
   * @param {Object} obj - Object to mask
   * @param {Array<string>} sensitiveFields - Fields to mask
   * @returns {Object} Object with masked fields
   */
  maskObject(obj, sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'accessToken']) {
    if (!obj || typeof obj !== 'object') return obj;

    const masked = { ...obj };

    sensitiveFields.forEach((field) => {
      if (masked[field]) {
        masked[field] = '[REDACTED]';
      }
    });

    return masked;
  },
};

/**
 * Timing-safe comparison
 */
const timingSafeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
};

// ── JWT Support ─────────────────────────────────────────
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Convenience wrappers used by AuthService and auth middleware
 */
const hashPassword = (plainPassword) => password.hash(plainPassword);
const comparePassword = (plain, hashed) => password.compare(plain, hashed);
const generateSecureToken = (length) => tokens.generateSecure(length);
const generateOTP = (digits) => tokens.generateOTP(digits);
const generateRefreshToken = () => tokens.generateSecure(64);

const generateJWT = (payload, expiresIn = '24h') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

const verifyJWT = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = {
  password,
  tokens,
  aes,
  hashing,
  masking,
  timingSafeCompare,
  BCRYPT_ROUNDS,
  // Convenience exports for AuthService / auth middleware
  hashPassword,
  comparePassword,
  generateJWT,
  verifyJWT,
  generateSecureToken,
  generateRefreshToken,
  generateOTP,
};
