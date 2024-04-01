const fs = require("fs").promises;

exports.getBody = async (request) => {
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
};

exports.readFileAsBase64 = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  return buffer.toString("base64");
};
