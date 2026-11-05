const { z } = require('zod');

/** Parse a numeric route parameter such as /orders/:id */
exports.idParam = (value) => z.coerce.number().int().positive().parse(value);