import { describe, it, expect } from 'vitest';
import availability from '../src/services/availability.js';

describe('availability (pure logic)', () => {
  it('the scarcest ingredient decides how many portions are possible', () => {
    const rows = [
      { qty_per_portion: 0.25, stock_qty: 50 },
      { qty_per_portion: 0.2, stock_qty: 0.5 },
    ];
    expect(availability.dishPortions(rows)).toBe(2);
  });

  it('a dish with no recipe has zero portions', () => {
    expect(availability.dishPortions([])).toBe(0);
  });

  it('handles floating point (0.3 / 0.1 must give 3 portions)', () => {
    expect(availability.dishPortions([{ qty_per_portion: 0.1, stock_qty: 0.3 }])).toBe(3);
  });

  it('gives the right unavailable reason, in priority order', () => {
    const dish = { is_available: true, force_unavailable: false };
    expect(availability.unavailableReason(dish, false, 5)).toBe('no_recipe');
    expect(availability.unavailableReason({ ...dish, force_unavailable: true }, true, 5)).toBe('override');
    expect(availability.unavailableReason({ ...dish, is_available: false }, true, 5)).toBe('manual');
    expect(availability.unavailableReason(dish, true, 0)).toBe('out_of_stock');
    expect(availability.unavailableReason(dish, true, 3)).toBe(null);
  });

  it('a modifier is available only if stock covers its ingredients', () => {
    expect(availability.modifierAvailable([{ qty: 0.2, stock_qty: 1 }])).toBe(true);
    expect(availability.modifierAvailable([{ qty: 0.2, stock_qty: 0.1 }])).toBe(false);
    expect(availability.modifierAvailable([])).toBe(true);
  });
});