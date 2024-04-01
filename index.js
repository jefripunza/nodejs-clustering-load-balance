const fs = require("node:fs");

const { availableParallelism } = require("node:os");
const cluster = require("node:cluster");

const { createServer } = require("node:http");

const logic = require("./logic");
const { port } = require("./env");
const { temp_folder } = require("./variable");

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

if (cluster.isPrimary) {
  const worker = process.env.WORKER;
  let numWorkers = 4;
  if (!worker && availableParallelism) {
    numWorkers = availableParallelism();
  }
  if (worker) {
    numWorkers = parseInt(worker);
  }
  console.log({ numWorkers });
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork({
      // set ENV on cluster ...
      PORT: parseInt(port) + i,
    });
  }

  // --------------------------------------------------------------------
  //-> one execute...

  if (!fs.existsSync(temp_folder)) {
    fs.mkdirSync(temp_folder);
  }

  return;
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

const server = createServer(logic.core);
server.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
