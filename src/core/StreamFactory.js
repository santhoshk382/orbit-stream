const clients = {};

async function createClient(config) {
  if (!config || !config.type) {
    throw new Error("Stream client config.type is required");
  }

  if (clients[config.type]) {
    return clients[config.type];
  }

  let ClientClass;

  if (config.type === "rabbitmq") {
    ClientClass = require("../adapters/RabbitMQAdapter");
  } else if (config.type === "valkey") {
    ClientClass = require("../adapters/ValkeyAdapter");
  } else {
    throw new Error(`Unsupported stream client type: ${config.type}`);
  }

  const client = new ClientClass(config);

  await client.connect();

  clients[config.type] = client;

  return client;
}

module.exports = {
  createClient,
};