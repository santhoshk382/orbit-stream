const WebSocket = require("ws");

const EventEmitter = require("events");

class WebSocketClient extends EventEmitter {
  constructor(url) {
    super();

    this.url = url;

    this.buffer = [];

    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      this.emit("connected");

      for (const msg of this.buffer) this.ws.send(msg);

      this.buffer = [];
    });

    this.ws.on("message", (msg) => this.emit("message", JSON.parse(msg)));

    this.ws.on("close", () => setTimeout(() => this.connect(), 2000));
  }

  subscribe(channel) {
    this.send(JSON.stringify({ channel }));
  }

  send(msg) {
    if (this.ws.readyState !== 1) {
      this.buffer.push(msg);

      return;
    }

    this.ws.send(msg);
  }
}

module.exports = WebSocketClient;
