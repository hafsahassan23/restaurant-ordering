const HOME = { manager: '/manager', cashier: '/cashier', waiter: '/waiter', kitchen: '/kitchen' };

/** Home page of each role. */
export const homeFor = (role) => HOME[role] || '/login';