const Valkey = require("../adapters/ValkeyAdapter");

const RabbitMQ = require("../adapters/RabbitMQAdapter");

async function createClient(config) {
  let client;

  if (config.type === "valkey") client = new Valkey(config);

  if (config.type === "rabbitmq") client = new RabbitMQ(config);

  await client.connect();

  return client;
}

module.exports = {
  createClient,
};
