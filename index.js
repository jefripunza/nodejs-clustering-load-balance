const { join } = require("node:path");
const fs = require("node:fs");

const { availableParallelism } = require("node:os");
const cluster = require("node:cluster");

const { createServer } = require("node:http");

const { v4: uuidv4 } = require("uuid");

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

const primaryPort = 3000;
const port = process.env.PORT ?? primaryPort;
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

const server = createServer((req, res) => {
  res.writeHead(200, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  });
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  res.end(JSON.stringify({
    message: "Hello World!",
    worker: cluster.worker.id,
    pid: process.pid,
    uuid: uuidv4(),
  }));
});
// starts a simple http server locally on port 3000
server.listen(port, '127.0.0.1', () => {
  console.log(`Listening on 127.0.0.1:${port}`);
});