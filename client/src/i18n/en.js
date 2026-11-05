export default {
  app: { name: 'Restoran Banaadir', tagline: 'Restaurant Management' },
  common: {
    loading: 'Loading...', save: 'Save', cancel: 'Cancel', confirm: 'Confirm',
    edit: 'Edit', delete: 'Delete', back: 'Back', logout: 'Log out',
    empty: 'Nothing here yet', error: 'Something went wrong', retry: 'Try again',
  },
  auth: {
    username: 'Username', password: 'Password', show: 'Show', hide: 'Hide',
    submit: 'Log in', loading: 'Logging in...',
    usernameRequired: 'Username is required', usernameMin: 'Username must be at least 3 characters',
    passwordRequired: 'Password is required', passwordMin: 'Password must be at least 6 characters',
    invalid: 'Incorrect username or password',
    tooMany: 'Too many attempts, please wait a moment',
    network: 'Cannot reach the server, check the connection',
  },
  roles: { manager: 'Manager', cashier: 'Cashier', waiter: 'Waiter', kitchen: 'Kitchen' },
  tableStatus: {
    free: 'Free', ordering: 'Ordering', waiting_food: 'Waiting for food', eating: 'Eating', paying: 'Paying',
  },
  itemStatus: {
    pending: 'Awaiting confirmation', ordered: 'Ordered', cooking: 'Cooking',
    ready: 'Ready', served: 'Served', cancelled: 'Cancelled',
  },
  home: {
    welcome: 'Welcome', online: 'Live connection: online', offline: 'Live connection: offline',
    soon: 'This screen is being built',
  },
};