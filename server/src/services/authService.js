const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const userRepository = require('../repositories/userRepository');
const auditService = require('./auditService');

/**
 * Check username/password and return a JWT plus the public user.
 * Errors: 401 on wrong credentials or disabled account.
 */
exports.login = async (username, password, ip) => {
  const user = await userRepository.findByUsername(username);
  const ok = user && user.is_active && (await bcrypt.compare(password, user.password_hash));

  if (!ok) {
    await auditService.log({ userId: user ? user.id : null, action: 'LOGIN_FAILED', entity: 'user', details: { username }, ip });
    throw new AppError(401, 'Invalid username or password', 'INVALID_CREDENTIALS');
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
  await auditService.log({ userId: user.id, action: 'LOGIN', entity: 'user', entityId: user.id, ip });

  return {
    token,
    user: { id: user.id, full_name: user.full_name, username: user.username, role: user.role },
  };
};