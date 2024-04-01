const { join } = require("node:path");
const fs = require("node:fs");
const crypto = require("crypto");

const cluster = require("node:cluster");

const formidable = require("formidable");
const querystring = require("querystring");

const { faviconBase64 } = require("./assets");
const {} = require("./env");
const { getBody, readFileAsBase64 } = require("./function");
const { executeScript } = require("./execute");

const routes = require("./routes");

exports.core = async (request, response) => {
  let fine_headers = {
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

  if (request.url.endsWith("/favicon.ico")) {
    const imageData = Buffer.from(faviconBase64, "base64");
    response.writeHead(200, { "Content-Type": "image/png" });
    response.end(imageData);
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

  // Find matching route
  const route = routes.find((route) => {
    const routeParts = route.endpoint.split("/").filter((v) => v != "");
    const requestParts = endpoint.split("/").filter((v) => v != "");
    if (routeParts.length !== requestParts.length) return false;
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(":")) continue;
      if (routeParts[i] !== requestParts[i]) return false;
    }
    return true;
  });
  let is_found = false;
  if (
    route &&
    String(route.method).toLowerCase() == String(method).toLowerCase()
  ) {
    is_found = true;
  }
  if (!is_found) {
    response.writeHead(404, fine_headers);
    response.end("404 Endpoint Not Found");
    return;
  }
  const request_id = crypto.randomUUID();

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
      body = JSON.parse(await getBody(request));
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

  const params = {};
  const keys = route.endpoint.match(/:([^\/]+)/g) || [];
  const match = endpoint.match(
    new RegExp("^" + route.endpoint.replace(/:([^\/]+)/g, "([^/]+)") + "$")
  );
  if (match) {
    keys.forEach((key, index) => {
      const key_of_param = key.replace(":", "");
      const value_of_param = match[index + 1];
      if (value_of_param) {
        params[key_of_param] = value_of_param;
      }
    });
  }

  const req = {
    worker_id: cluster.worker.id,
    pid: process.pid,
    request_id,
    httpVersion,

    hostname,
    headers,
    origin,
    url,
    method,
    router: route.endpoint,
    endpoint,
    params,
    query,
    body,
    files,
  };

  // ====================================================================
  // ====================================================================
  // ====================================================================

  // Execute script
  let result_eval;
  try {
    let script = `const req = ${JSON.stringify(req)};`;
    script += `${route.script};`;
    result_eval = await executeScript(request_id, script); // Execute the script
  } catch (error) {
    console.error("Error executing script:", error);
    result_eval = { statusCode: 500, error: "Internal Server Error" };
  }

  let contentType = "plain/text";
  let statusCode = 200;
  let cookies = {};
  let result;

  if (typeof result_eval == "string") {
    result = result_eval;
  } else if (typeof result_eval == "object" && !Array.isArray(result_eval)) {
    contentType = "application/json";
    if (
      result_eval?.statusCode &&
      typeof result_eval.statusCode == "number" &&
      Number(result_eval.statusCode).length == 3
    ) {
      statusCode = result_eval.statusCode;
    }
    if (
      result_eval?.headers &&
      typeof result_eval.headers == "object" &&
      !Array.isArray(result_eval.headers)
    ) {
      fine_headers = {
        ...fine_headers,
        ...result_eval.headers,
      };
    }
    if (
      result_eval?.cookies &&
      typeof result_eval.cookies == "object" &&
      !Array.isArray(result_eval.cookies)
    ) {
      cookies = result_eval.cookies;
    }
    if (result_eval?.response) {
      if (["boolean", "number"].includes(typeof result_eval.response)) {
        result = { value: result_eval.response };
      } else if (
        typeof result_eval.response == "object" &&
        Array.isArray(result_eval.response)
      ) {
        result = { data: result_eval.response };
      } else if (typeof result_eval.response == "undefined") {
        result = { return: "undefined" };
      } else {
        result = { ...result_eval.response };
      }
    } else {
      result = { ...result_eval };
    }
  }

  fine_headers["Content-Type"] = contentType;
  response.writeHead(statusCode, fine_headers);
  if (typeof result == "object") {
    response.end(JSON.stringify(result, null, 2));
  } else {
    response.end(result);
  }
};
