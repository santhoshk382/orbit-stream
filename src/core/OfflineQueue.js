class OfflineQueue {
  constructor(config = {}) {
    this.queue = [];

    this.maxSize = config.maxSize ?? 100000;
  }

  push(item) {
    if (this.queue.length >= this.maxSize) this.queue.shift();

    this.queue.push(item);
  }

  drain(handler) {
    const items = [...this.queue];

    this.queue = [];

    return handler(items);
  }
}

module.exports = OfflineQueue;
