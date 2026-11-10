/**
 * Error with an HTTP status code, caught by the global error handler.
 * `extra` adds safe fields to the JSON answer (e.g. a payment reference or a field name).
 */
class AppError extends Error {
  constructor(status, message, code, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
module.exports = AppError;