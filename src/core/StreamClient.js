const EventEmitter = require("events");

const OfflineQueue = require("./OfflineQueue");

const PersistentQueue = require("./PersistentQueue");

class StreamClient extends EventEmitter {
  constructor(config) {
    super();

    this.config = config;

    this.connected = false;

    this.subscriptions = new Map();

    this.offlineQueue = new OfflineQueue(config.buffer);

    this.persistentQueue = new PersistentQueue(config.persistence);
  }

  async publish(channel, message, options = {}) {
    if (!this.connected) {
      const item = {
        channel,
        message,
        options,
      };

      this.offlineQueue.push(item);

      this.persistentQueue.push(item);

      this.emit("buffered", this.offlineQueue.queue.length);

      return;
    }

    return this._publishNow(channel, message, options);
  }

  async flushOfflineQueue() {
    await this.offlineQueue.drain(async (items) => {
      for (const item of items) {
        await this._publishNow(item.channel, item.message, item.options);
      }

      this.emit("offlineQueueFlushed", items.length);
    });
  }

  async flushPersistentQueue() {
    await this.persistentQueue.drain(async (items) => {
      for (const item of items) {
        await this._publishNow(item.channel, item.message, item.options);
      }

      this.emit("persistentQueueFlushed", items.length);
    });
  }

  async restoreSubscriptions() {
    for (const [channel, handler] of this.subscriptions) {
      await this.subscribe(channel, handler, true);
    }
  }
}

module.exports = StreamClient;
