/**
 * Browsers allowed to call the API and the sockets: the Vite dev server on this computer
 * or on the restaurant's local network (phones scanning the QR code on the same Wi-Fi).
 */
module.exports = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
  /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
  /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/, // 172.16.0.0/12, e.g. phone hotspots (172.20.10.x)
];