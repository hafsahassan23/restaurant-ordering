const { z } = require('zod');

const itemSchema = z.object({
  dishId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20).default(1),
  notes: z.string().max(255).optional(),
  modifierIds: z.array(z.number().int().positive()).max(20).default([]),
});

exports.itemsSchema = z.array(itemSchema).min(1).max(30);