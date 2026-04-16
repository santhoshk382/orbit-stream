const { createClient } = require("../index");

(async () => {
  try {
    console.log("Connecting to RabbitMQ...");

    const client = await createClient({
      type: "rabbitmq",
      url: "amqp://localhost",
    });

    console.log("Connected. Starting producer...");

    setInterval(async () => {
      const message = {
        message: "Hello RabbitMQ",
        timestamp: new Date().toISOString(),
      };

      await client.publish("test-queue", message);

      console.log("Sent:", message);
    }, 2000);
  } catch (err) {
    console.error("Producer error:", err);
  }
})();
