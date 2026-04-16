const EventEmitter = require("events");

class ConnectionManager extends EventEmitter {
  constructor(connectFn, config = {}) {
    super();

    this.connectFn = connectFn;

    this.retries = 0;

    this.maxRetries = config.reconnect?.retries ?? Infinity;

    this.minDelay = config.reconnect?.minDelay ?? 1000;

    this.maxDelay = config.reconnect?.maxDelay ?? 30000;

    this.factor = config.reconnect?.factor ?? 2;

    this.connect();
  }

  async connect() {
    try {
      await this.connectFn();

      this.retries = 0;

      this.emit("connected");
    } catch (err) {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.retries >= this.maxRetries) return;

    const delay = Math.min(
      this.minDelay * Math.pow(this.factor, this.retries),
      this.maxDelay,
    );

    this.retries++;

    this.emit("reconnecting", delay);

    setTimeout(() => {
      this.connect();
    }, delay);
  }
}

module.exports = ConnectionManager;
