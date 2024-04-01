const { join } = require("node:path");
const fs = require("node:fs");
const crypto = require("crypto");

const { availableParallelism } = require("node:os");
const cluster = require("node:cluster");

const { createServer } = require("node:http");
const formidable = require("formidable");
const querystring = require("querystring");

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

if (cluster.isPrimary) {
  require("dotenv").config();
}

const defaultPort = 3001; // 3000 or 80 is NGINX
const port = process.env.PORT ?? defaultPort;

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
  return;
}

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

const server = createServer(async (request, response) => {
  const fine_headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Credentials": "true",
  };
  if (request.method === "OPTIONS") {
    response.writeHead(200, fine_headers);
    response.end();
    return;
  }

  // ====================================================================
  // ====================================================================
  // ====================================================================

  const { httpVersion, url: _url, method, headers } = request;

  const hostname = headers.host;
  const origin = headers.origin;
  let url = querystring.parse(_url);
  url = Object.keys(url)
    .reduce((saved, key) => [...saved, `${key}=${url[key]}`], [])
    .join("&");
  const endpoint = url.split("?")[0];

  const queryPart = url.split("?")[1] || "";
  let query = {};
  if (queryPart !== "") {
    query = querystring.parse(queryPart);
    query = Object.keys(query).reduce((saved, key) => {
      let value = query[key];
      if (value === "" || value === "true") {
        value = true;
      } else if (value === "false") {
        value = false;
      } else {
        if (
          (value.startsWith("[") && value.endsWith("]")) ||
          (value.startsWith("{") && value.endsWith("}"))
        ) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // stay string...
          }
        }
      }
      return {
        ...saved,
        [key]: value,
      };
    }, {});
  }

  let body = {};
  if (request.headers["content-type"]?.includes("application/json")) {
    try {
      body = JSON.parse(await getText(request));
    } catch (_) {
      // no body...
    }
  }

  const files = {};
  if (
    request.method === "POST" &&
    request.headers["content-type"]?.startsWith("multipart/form-data")
  ) {
    const form = new formidable.IncomingForm();

    const formParsePromise = new Promise((resolve, reject) => {
      form.parse(request, async (err, fields, formFiles) => {
        if (err) {
          reject(err);
          return;
        }

        for (const [field, val] of Object.entries(fields)) {
          body[field] = val[0];
        }

        for (const [field, val] of Object.entries(formFiles)) {
          if (val instanceof Array) {
            for (const file of val) {
              if (file && file.filepath) {
                const { originalFilename } = file;
                const extension = originalFilename.split(".").pop();
                const uuid_name = crypto.randomUUID();
                const new_name = `${uuid_name}.${extension}`;
                const file_size_mb = file.size / (1024 * 1024);

                const base64String = await readFileAsBase64(file.filepath);

                files[field] = {
                  filename: originalFilename,
                  new_name,
                  extension,
                  file_size_mb,
                  base64: base64String,
                };
              }
            }
          } else {
            if (val && val.filepath) {
              // Periksa apakah properti filepath ada
              const { originalFilename } = val;
              const extension = originalFilename.split(".").pop();
              const uuid_name = crypto.randomUUID();
              const new_name = `${uuid_name}.${extension}`;
              const file_size_mb = val.size / (1024 * 1024);

              const base64String = await readFileAsBase64(val.filepath);

              files[field] = {
                filename: originalFilename,
                new_name,
                extension,
                file_size_mb,
                base64: base64String,
              };
            }
          }
        }

        resolve();
      });
    });

    try {
      await formParsePromise;
    } catch (err) {
      console.error("Error parsing form:", err);
    }
  }

  const req = {
    worker_id: cluster.worker.id,
    httpVersion,
    hostname,
    headers,
    origin,
    url,
    method,
    endpoint,
    query,
    body,
    files,
  };

  // ====================================================================
  // ====================================================================
  // ====================================================================

  const result = JSON.stringify(
    {
      message: "Hello World!",
      worker: cluster.worker.id,
      pid: process.pid,
      req,
    },
    null,
    2
  );
  fine_headers["Content-Type"] = "application/json";
  response.writeHead(200, fine_headers);
  response.end(result);
});

server.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});

async function getText(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      resolve(body);
    });
    request.on("error", (err) => {
      reject(err);
    });
  });
}

async function readFileAsBase64(filePath) {
  const fs = require("fs").promises;
  const buffer = await fs.readFile(filePath);
  return buffer.toString("base64");
}
