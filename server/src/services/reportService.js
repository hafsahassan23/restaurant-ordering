const reportRepository = require('../repositories/reportRepository');

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
const isoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Report for a date range (default: the last 7 days). All numbers come from the database. */
exports.summary = async ({ from, to }) => {
  const end = to || isoDate(new Date());
  const base = new Date(`${end}T00:00:00`);
  base.setDate(base.getDate() - 6);
  const start = from || isoDate(base);

  const daily = (await reportRepository.dailySales(start, end)).map((r) => ({
    day: r.day, total: round2(Number(r.total)), bills: Number(r.bills),
  }));

  const byDish = (await reportRepository.salesByDish(start, end)).map((r) => ({
    dish_id: r.dish_id, name_so: r.name_so, name_en: r.name_en,
    category_id: r.category_id, category_name_so: r.category_name_so, category_name_en: r.category_name_en,
    qty: Number(r.qty), revenue: round2(Number(r.revenue)),
  }));

  const categories = new Map();
  for (const d of byDish) {
    const c = categories.get(d.category_id) ||
      { id: d.category_id, name_so: d.category_name_so, name_en: d.category_name_en, qty: 0, revenue: 0 };
    c.qty += d.qty;
    c.revenue = round2(c.revenue + d.revenue);
    categories.set(d.category_id, c);
  }

  const avgPrep = await reportRepository.avgPrepSeconds(start, end);

  const foodCost = (await reportRepository.dishCosts())
    .map((r) => {
      const price = Number(r.price);
      const cost = round2(Number(r.cost));
      const pct = price > 0 ? round1((cost / price) * 100) : 0;
      return { dish_id: r.dish_id, name_so: r.name_so, name_en: r.name_en, price, cost, pct, high: pct > 40 };
    })
    .sort((a, b) => b.pct - a.pct);

  return {
    range: { from: start, to: end },
    totals: {
      sales: round2(daily.reduce((s, d) => s + d.total, 0)),
      bills: daily.reduce((s, d) => s + d.bills, 0),
      avg_prep_seconds: avgPrep,
    },
    daily,
    by_dish: byDish,
    by_category: [...categories.values()],
    food_cost: foodCost,
  };
};