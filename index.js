const { createClient } = require("./src/core/StreamFactory");

const WebSocketServer = require("./src/websocket/WebSocketServer");

const WebSocketClient = require("./src/websocket/WebSocketClient");

module.exports = {
  createClient,
  WebSocketServer,
  WebSocketClient,
};
