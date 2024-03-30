const { exec } = require("child_process");
const fs = require("fs");
const axios = require("axios");

// Function untuk melakukan request
const request = (host) => {
  return axios
    .get(host)
    .then((response) => {
      return {
        status: response.status,
        body: response.data,
      };
    })
    .catch((error) => {
      throw error;
    });
};

// Assign argumen ke variabel
const service = process.argv[2];
const host = process.argv[3];
const loopCount = parseInt(process.argv[4]);
const packageCount = parseInt(process.argv[5]);

if (!service || !host || !loopCount || !packageCount) {
  console.log(
    "Usage: node test.js <service_name_in_docker_compose> <host> <loop_count> <package_count>"
  );
  process.exit(1);
}

// Mendapatkan penggunaan memori sebelum melakukan performance test
console.log("restart service...");
exec(`docker restart ${service}"`, async (error, stdout, stderr) => {
  if (error) {
    console.error(`Error restart service: ${error.message}`);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log("Getting start service stats...");
  exec(
    `docker stats --no-stream ${service} --format "{{.MemUsage}}"`,
    async (error, stdout, stderr) => {
      if (error) {
        console.error(`Error getting start service stats: ${error.message}`);
        return;
      }
      const startUsedMemory = stdout.split("/")[0].trim();

      // Melakukan eksekusi sebanyak LOOP_COUNT
      console.log("Processing requests...");
      const done_requests = [];
      (async () => {
        let requestsSent = 0;
        while (requestsSent < loopCount) {
          for (let i = 0; i < packageCount; i++) {
            (async () => {
              try {
                const resp = await request(host);
                done_requests.push(resp);
              } catch (err) {
                console.error(`Error processing request: ${err.message}`);
                done_requests.push({
                  error: err.message,
                });
              }
            })();
          }
          requestsSent++;
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Tunggu 1 detik sebelum melanjutkan
        }
      })();
      console.log("Process in background...");
      while (done_requests.length < loopCount * packageCount) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      console.log({ length: done_requests.length });

      // Mendapatkan penggunaan memori setelah melakukan performance test
      console.log("Getting end service stats...");
      exec(
        `docker stats --no-stream ${service} --format "{{.MemUsage}}"`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Error getting end service stats: ${error.message}`);
            return;
          }
          const endUsedMemory = stdout.split("/")[0].trim();

          // Format tanggal dan waktu saat ini
          const timestamp = new Date()
            .toISOString()
            .slice(0, 19)
            .replace("T", " ");

          // Membuat log hasil performance test
          const logMessage = `${timestamp}|${loopCount}|${startUsedMemory}|${endUsedMemory}\n`;

          // Menyimpan log ke dalam test-result.txt dengan mode append
          fs.appendFile("test-result.txt", logMessage, (err) => {
            if (err) {
              console.error(`Error writing to test-result.txt: ${err.message}`);
            } else {
              console.log("Finish!");
            }
          });
        }
      );
    }
  );
});
