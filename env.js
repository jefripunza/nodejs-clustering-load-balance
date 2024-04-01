const cluster = require("node:cluster");

if (cluster.isPrimary) {
  require("dotenv").config();
}

const defaultPort = 3001; // 3000 or 80 is NGINX
exports.port = process.env.PORT ?? defaultPort;
