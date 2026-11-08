const HOME = { manager: '/manager/reports', cashier: '/cashier', waiter: '/waiter', kitchen: '/kitchen' };

/** Home page of each role. */
export const homeFor = (role) => HOME[role] || '/login';