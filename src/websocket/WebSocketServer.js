const WebSocket = require("ws");

class WebSocketServer {
  constructor(port, config = {}) {
    this.port = port;
    this.channels = new Map();
    this._closing = false;

    // Retry configuration
    this.retries = 0;
    this.maxRetries = config.retries ?? Infinity;
    this.minDelay = config.minDelay ?? 1000;
    this.maxDelay = config.maxDelay ?? 30000;
    this.factor = config.factor ?? 2;

    this._start();
  }

  /* ---------------- START SERVER ---------------- */

  _start() {
    try {
      this.server = new WebSocket.Server({ port: this.port });

      this.server.once("listening", () => {
        console.log(`✅ WebSocket listening on ${this.port}`);
        this.retries = 0;
      });

      this.server.on("connection", (ws) => {
        ws.on("message", (msg) => {
          let parsed;
          try {
            parsed = JSON.parse(msg);
          } catch {
            return;
          }

          const { channel } = parsed;
          if (!channel) return;

          if (!this.channels.has(channel)) {
            this.channels.set(channel, new Set());
          }

          this.channels.get(channel).add(ws);
          ws._channel = channel;
        });

        ws.on("close", () => this._cleanup(ws));
        ws.on("error", () => this._cleanup(ws));
      });

      this.server.on("close", () => {
        if (!this._closing) {
          this._scheduleReconnect();
        }
      });

      this.server.on("error", (err) => {
        console.error("WebSocket error:", err.message);

        if (!this._closing) {
          this._scheduleReconnect();
        }
      });
    } catch (err) {
      console.error("WebSocket startup failed:", err.message);
      this._scheduleReconnect();
    }
  }

  /* ---------------- RECONNECT LOGIC ---------------- */

  _scheduleReconnect() {
    if (this.retries >= this.maxRetries) {
      console.error("❌ WebSocket max retries reached");
      return;
    }

    const delay = Math.min(
      this.minDelay * Math.pow(this.factor, this.retries),
      this.maxDelay,
    );

    this.retries++;

    console.log(`🔁 WebSocket restarting in ${delay}ms`);

    setTimeout(() => {
      if (!this._closing) {
        this._start();
      }
    }, delay);
  }

  /* ---------------- BROADCAST ---------------- */

  broadcast(channel, message) {
    const clients = this.channels.get(channel);
    if (!clients) return;

    const payload = JSON.stringify(message);

    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      } else {
        this._cleanup(ws);
      }
    }
  }

  /* ---------------- CLEANUP ---------------- */

  _cleanup(ws) {
    const channel = ws._channel;
    if (!channel) return;

    const set = this.channels.get(channel);
    if (!set) return;

    set.delete(ws);

    if (set.size === 0) {
      this.channels.delete(channel);
    }
  }

  /* ---------------- SHUTDOWN ---------------- */

  async close() {
    this._closing = true;

    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve);
      });
    }
  }
}

module.exports = WebSocketServer;
