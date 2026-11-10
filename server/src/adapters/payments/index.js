/**
 * Payment gateway selector. Only the demo provider exists today; real EVC Plus / eDahab /
 * ZAAD / WAAFI / card integrations would be added as separate files with the same interface
 * and chosen here by PAYMENT_MODE. Demo logic never mixes with real integrations.
 */
const MODE = process.env.PAYMENT_MODE || 'demo';

const gateways = {
  demo: () => require('./demoGateway'),
};

if (!gateways[MODE]) throw new Error(`Unknown PAYMENT_MODE "${MODE}" (only "demo" is available)`);

module.exports = gateways[MODE]();
