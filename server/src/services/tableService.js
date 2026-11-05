const AppError = require('../utils/AppError');
const tableRepository = require('../repositories/tableRepository');

exports.list = () => tableRepository.list();

exports.getById = async (id) => {
  const table = await tableRepository.findById(id);
  if (!table) throw new AppError(404, 'Table not found', 'TABLE_NOT_FOUND');
  return table;
};

/** Customers identify their table by the secret QR token, never by number. */
exports.getByToken = async (token) => {
  const table = await tableRepository.findByToken(token);
  if (!table) throw new AppError(404, 'Invalid table code', 'INVALID_TABLE');
  return table;
};