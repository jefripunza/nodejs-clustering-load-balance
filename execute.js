const { Worker } = require("worker_threads");

const { timeout_second } = require("./variable");

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

const libraries = `
const { parentPort } = require('worker_threads');
const base64 = require('base-64');
const CryptoJS = require('crypto-js');
const { white } = require('chalk');
const axios = require('axios/dist/node/axios.cjs');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const knex = require('knex');
const mysql2 = require('mysql2');
const pg = require('pg');
const { parsePhoneNumber } = require('awesome-phonenumber');

//-> reporting...
// XLSX
const ExcelJS = require('exceljs');
// CSV
const Papa = require('papaparse');
const JsonToCSV = Papa.unparse;
const CSVToJSON = Papa.parse;
// DOCX
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

`;

const workerScript = `
${libraries}
parentPort.on('message', async (e) => {
  const originalConsole = console.log;
  console.log = (...args) => {
    parentPort.postMessage({ status: "log", args });
  };
  try {
    const result = await eval(\`(async () => { \${e.dependencies}\\n\${e.script} })()\`);
    parentPort.postMessage({ status: "success", result });
  } catch (error) {
    parentPort.postMessage({ status: "error", error: error.toString() });
  }
});
`;

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

exports.executeScript = async (request_id, script) => {
  const worker = new Worker(workerScript, { eval: true });

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      worker.terminate();
      reject(
        new Error(`Script execution timed out until ${timeout_second} second`)
      );
    }, 1000 * timeout_second);

    worker.on("message", (e) => {
      const { args, status, error, result } = e;
      if (status === "log") {
        // send log
        console.log(...args);
      } else if (status === "success") {
        clearTimeout(timeoutId);
        worker.terminate();
        resolve(result);
      } else if (status === "error") {
        clearTimeout(timeoutId);
        worker.terminate();
        reject(new Error(error));
      }
    });

    worker.on("error", (e) => {
      clearTimeout(timeoutId);
      worker.terminate();
      reject(new Error(e.message));
    });

    // Send the script to the worker for execution
    worker.postMessage({
      dependencies: [].join("\n"),
      script,
    });
  });
};
