const { WebSocketClient } = require("../index");

const client = new WebSocketClient("ws://localhost:8080");

client.on("connected", () => {
  client.subscribe("satellite:123");
});

client.on("message :: ", console.log);
