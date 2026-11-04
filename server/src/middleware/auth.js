const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const userRepository = require('../repositories/userRepository');

/** Require a valid JWT. Sets req.user = { id, full_name, username, role }. */
exports.authenticate = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError(401, 'Login required', 'NO_TOKEN');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError(401, 'Invalid or expired token', 'BAD_TOKEN');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user || !user.is_active) throw new AppError(401, 'Account not available', 'NO_USER');

  req.user = { id: user.id, full_name: user.full_name, username: user.username, role: user.role };
  next();
};

/** Allow only the listed roles. Checked on the server for every request. */
exports.authorize = (...allowed) => (req, res, next) => {
  if (!req.user || !allowed.includes(req.user.role)) {
    throw new AppError(403, 'You do not have permission', 'FORBIDDEN');
  }
  next();
};