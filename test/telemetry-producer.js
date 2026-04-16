const { createClient } = require("../index");

const TOTAL = 100000;
const BATCH_SIZE = 1000;

const hexString = `9f4a7`;
const packet_data = Buffer.from(hexString, "hex");

(async () => {
  const client = await createClient({
    type: "valkey",
    host: "127.0.0.1",
    port: 6379,
    reconnect: {
      retries: Infinity,
      minDelay: 1000,
      maxDelay: 10000,
    },
    persistence: {
      dir: "./orbit-buffer",
    },
  });

  let sent = 0;
  let sentThisSecond = 0;

  const startTime = new Date();
  console.log("Start Time:", startTime.toISOString());

  // 🔹 Print every second
  const interval = setInterval(() => {
    console.log("Sent/sec:", sentThisSecond, "| Total:", sent);
    sentThisSecond = 0;
  }, 1000);

  while (sent < TOTAL) {
    const batchLimit = Math.min(BATCH_SIZE, TOTAL - sent);

    for (let i = 0; i < batchLimit; i++) {
      client.publish(
        "satellite:123",
        { packet: packet_data },
        { maxLen: 100000 },
      );

      sent++;
      sentThisSecond++;
    }

    // Yield event loop
    await new Promise((resolve) => setImmediate(resolve));
  }

  clearInterval(interval);

  const endTime = new Date();
  const durationSec = (endTime - startTime) / 1000;

  console.log("\n===== FINAL SUMMARY =====");
  console.log("End Time:", endTime.toISOString());
  console.log("Total Sent:", sent);
  console.log("Duration:", durationSec.toFixed(3), "seconds");
  console.log("Average Throughput:", Math.round(sent / durationSec), "msg/sec");
})();
