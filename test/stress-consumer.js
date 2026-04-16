const { createClient } = require("../index");

const TARGET = 1000000; // stop after this many messages

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
  });

  client.on("connected", () => console.log("✅ Consumer connected"));

  client.on("reconnecting", (delay) =>
    console.log("🔁 Reconnecting in", delay),
  );

  client.on("error", (err) => console.log("⚠ Consumer error:", err.code));

  console.log("🚀 Consumer started");

  let received = 0;
  const start = Date.now();

  // Print every second
  const interval = setInterval(() => {
    const durationSec = (Date.now() - start) / 1000;

    const throughput = Math.round(received / durationSec);

    console.log(`📊 Total=${received} | ` + `AvgThroughput=${throughput}/sec`);
  }, 1000);

  await client.subscribe("stress-stream", (data) => {
    received++;

    if (received >= TARGET) {
      const durationSec = (Date.now() - start) / 1000;

      const throughput = Math.round(received / durationSec);

      clearInterval(interval);

      console.log("\n🎯 TARGET REACHED");
      console.log("Total Received:", received);
      console.log("Duration:", durationSec.toFixed(2), "sec");
      console.log("Average Throughput:", throughput, "msg/sec");

      process.exit(0);
    }
  });
})();
