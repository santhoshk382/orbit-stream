const amqp = require("amqplib");
const StreamClient = require("../core/StreamClient");
const ConnectionManager = require("../core/ConnectionManager");

class RabbitMQAdapter extends StreamClient {
  constructor(config) {
    super(config);

    this.conn = null;

    this.publishChannel = null;
    this.consumeChannel = null;

    this.connectionManager = null;
    this._closing = false;

    this.queues = new Set();
  }

  async connect() {
    if (this.conn) return;

    this._closing = false;

    this.connectionManager = new ConnectionManager(async () => {
      if (this.conn) return;

      this.conn = await amqp.connect(this.config.url);

      this.conn.on("error", (err) => {
        if (this.listenerCount("error") > 0) this.emit("error", err);
      });

      this.conn.on("close", () => {
        this.connected = false;

        this.conn = null;
        this.publishChannel = null;
        this.consumeChannel = null;

        if (!this._closing) {
          this.connectionManager.scheduleReconnect();
        }
      });

      // publisher channel (confirm)
      this.publishChannel = await this.conn.createConfirmChannel();

      // consumer channel
      this.consumeChannel = await this.conn.createChannel();

      await this.consumeChannel.prefetch(this.config.prefetch || 100);
    }, this.config);

    this.connectionManager.on("connected", async () => {
      this.connected = true;

      await this.restoreSubscriptions();
      await this.flushPersistentQueue();
      await this.flushOfflineQueue();

      this.emit("connected");
    });

    this.connectionManager.on("reconnecting", (delay) => {
      this.emit("reconnecting", delay);
    });
  }

  /* -------------------------------------------------- */
  /* ---------------- PUBLISH -------------------------- */
  /* -------------------------------------------------- */

  async _publishNow(queue, message) {
    if (!this.connected || !this.publishChannel) {
      this._buffer(queue, message);
      return;
    }

    try {
      if (!this.queues.has(queue)) {
        await this.publishChannel.assertQueue(queue, { durable: true });
        this.queues.add(queue);
      }

      this.publishChannel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
        }
      );

      await this.publishChannel.waitForConfirms();
    } catch (err) {
      this._buffer(queue, message);
    }
  }

  _buffer(queue, message) {
    const item = {
      channel: queue,
      message,
    };

    this.offlineQueue.push(item);
    this.persistentQueue.push(item);
  }

  /* -------------------------------------------------- */
  /* ---------------- SUBSCRIBE ------------------------ */
  /* -------------------------------------------------- */

  async subscribe(queue, handler, restore = false) {
    if (!this.connected || !this.consumeChannel) {
      await new Promise((resolve) => this.once("connected", resolve));
    }

    if (!restore) {
      this.subscriptions.set(queue, handler);
    }

    if (!this.queues.has(queue)) {
      await this.consumeChannel.assertQueue(queue, { durable: true });
      this.queues.add(queue);
    }

    await this.consumeChannel.consume(
      queue,
      async (msg) => {
        if (!msg) return;

        try {
          const data = JSON.parse(msg.content.toString());

          await handler(data);

          this.consumeChannel.ack(msg);
        } catch (err) {
          this.consumeChannel.nack(msg, false, false);
        }
      },
      { noAck: false }
    );
  }

  /* -------------------------------------------------- */
  /* ---------------- SHUTDOWN ------------------------- */
  /* -------------------------------------------------- */

  async close() {
    this._closing = true;

    try {
      if (this.publishChannel) {
        await this.publishChannel.close();
        this.publishChannel = null;
      }

      if (this.consumeChannel) {
        await this.consumeChannel.close();
        this.consumeChannel = null;
      }

      if (this.conn) {
        await this.conn.close();
        this.conn = null;
      }
    } catch (err) {
      this.emit("error", err);
    }

    this.connected = false;
  }
}

module.exports = RabbitMQAdapter;