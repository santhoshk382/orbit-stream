const { createClient, WebSocketServer } = require("../index");

// Start WebSocket server
// const wsServer = new WebSocketServer(8080);

const EXPECTED_TOTAL = 100000;

(async () => {
  const client = await createClient({
    type: "valkey",
    host: "127.0.0.1",
    port: 6379,
    group: "telemetry",
  });

  let total = 0;
  let receivedThisSecond = 0;
  let startTime = null;

  // 🔹 Print every second
  const interval = setInterval(() => {
    if (startTime) {
      console.log("Received/sec:", receivedThisSecond, "| Total:", total);
    }
    receivedThisSecond = 0;
  }, 1000);

  await client.subscribe("satellite:123", (message) => {
    // If JSON stored:
    // const parsed = JSON.parse(message.data);

    // wsServer.broadcast("satellite:123", message);

    if (!startTime) {
      startTime = new Date();
      console.log("Start Time:", startTime.toISOString());
    }

    total++;
    receivedThisSecond++;

    if (total === EXPECTED_TOTAL) {
      clearInterval(interval);

      const endTime = new Date();
      const durationSec = (endTime - startTime) / 1000;

      console.log("\n===== SUMMARY =====");
      console.log("Start Time:", startTime.toISOString());
      console.log("End Time:", endTime.toISOString());
      console.log("Total Received:", total);
      console.log("Duration:", durationSec.toFixed(3), "sec");
      console.log(
        "Average Throughput:",
        Math.round(total / durationSec),
        "msg/sec",
      );
      console.log("===================\n");

      process.exit(0);
    }
  });
})();
