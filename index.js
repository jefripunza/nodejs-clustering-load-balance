const { join } = require("node:path");
const fs = require("node:fs");

const { availableParallelism } = require("node:os");
const cluster = require("node:cluster");

const { createServer } = require("node:http");

const { v4: uuidv4 } = require("uuid");

require("dotenv").config();

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

const defaultPort = 3001; // 3000 is NGINX
const port = process.env.PORT ?? defaultPort;
const worker = process.env.WORKER;

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

if (cluster.isPrimary) {
  let numWorkers = 4;
  if (!worker && availableParallelism) {
    numWorkers = availableParallelism();
  }
  if (worker) {
    numWorkers = parseInt(worker);
  }
  console.log({ numWorkers });
  // create one worker per available core
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork({
      // set ENV on cluster ...
      PORT: parseInt(port) + i,
    });
  }
  return;
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

const server = createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  });
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  res.end(
    JSON.stringify({
      message: "Hello World!",
      worker: cluster.worker.id,
      pid: process.pid,
      uuid: uuidv4(),
    })
  );
});

server.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
