const { createClient } = require("./src/core/StreamFactory");

module.exports = {
  createClient,

  get WebSocketServer() {
    return require("./src/websocket/WebSocketServer");
  },

  get WebSocketClient() {
    return require("./src/websocket/WebSocketClient");
  },
};