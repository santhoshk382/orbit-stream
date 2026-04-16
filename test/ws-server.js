const { WebSocketServer, createClient } = require("../index");

(async () => {
  try {
    console.log("Starting WebSocket server...");

    // Start WebSocket server
    const wsServer = new WebSocketServer(8080);

    console.log("WebSocket server started on port 8080");

    // Connect to RabbitMQ
    const client = await createClient({
      type: "rabbitmq",
      url: "amqp://localhost",
    });

    console.log("Connected to RabbitMQ");

    // Subscribe to RabbitMQ queue
    await client.subscribe("test-queue", async (message) => {
      console.log("Received from RabbitMQ:", message);

      // Broadcast to WebSocket clients
      wsServer.broadcast("satellite:123", message);

      console.log("Broadcasted to WebSocket clients");
    });

    console.log("Subscribed to test-queue");
  } catch (err) {
    console.error("WebSocket Server Error:", err);
  }
})();
