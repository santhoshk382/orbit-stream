const { createClient } = require("../index");

const TOTAL = 1000000; // change to 10_000_000 for heavy test
const BATCH = 1000;

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

  client.on("connected", () => console.log("Producer connected"));

  client.on("reconnecting", (delay) => console.log("Reconnecting in", delay));

  client.on("error", (err) => console.log("Producer error:", err.code));

  let sent = 0;
  const start = Date.now();

  while (sent < TOTAL) {
    const batch = [];

    for (let i = 0; i < BATCH && sent < TOTAL; i++) {
      batch.push({
        id: sent,
        ts: Date.now(),
      });

      sent++;
    }

    await client.publishBatch("stress-stream", batch, {
      maxLen: 2000000,
    });

    if (sent % 100000 === 0) console.log("Sent:", sent);
  }

  const duration = (Date.now() - start) / 1000;

  console.log("\nProducer finished");
  console.log("Total Sent:", sent);
  console.log("Duration:", duration, "sec");
  console.log("Throughput:", Math.round(sent / duration), "msg/sec");
})();
