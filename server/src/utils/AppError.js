/** Error with an HTTP status code, caught by the global error handler. */
class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
module.exports = AppError;