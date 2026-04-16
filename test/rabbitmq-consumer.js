const { createClient } = require("../index");

(async () => {
  try {
    console.log("Connecting to RabbitMQ...");

    const client = await createClient({
      type: "rabbitmq",
      url: "amqp://localhost",
    });

    console.log("Connected to RabbitMQ");

    await client.subscribe("test-queue", async (message) => {
      console.log("Received message:", message);

      // your processing logic here
    });

    console.log("Subscribed to test-queue");
  } catch (err) {
    console.error("Consumer error:", err);
  }
})();
