const amqp = require("amqplib");
const StreamClient = require("../core/StreamClient");
const ConnectionManager = require("../core/ConnectionManager");

class RabbitMQAdapter extends StreamClient {
  async connect() {
    this._closing = false;

    this.connectionManager = new ConnectionManager(async () => {
      this.conn = await amqp.connect(this.config.url);

      this.conn.on("error", (err) => {
        if (this.listenerCount("error") > 0) this.emit("error", err);
      });

      this.conn.on("close", () => {
        this.connected = false;
        if (!this._closing) this.connectionManager.scheduleReconnect();
      });

      // Use ConfirmChannel for guaranteed delivery
      this.channel = await this.conn.createConfirmChannel();

      // Optional: limit unacked messages per consumer
      await this.channel.prefetch(this.config.prefetch || 100);
    }, this.config);

    this.connectionManager.on("connected", async () => {
      this.connected = true;

      await this.restoreSubscriptions();
      await this.flushPersistentQueue();
      await this.flushOfflineQueue();

      this.emit("connected");
    });

    this.connectionManager.on("reconnecting", (delay) =>
      this.emit("reconnecting", delay),
    );
  }

  /* -------------------------------------------------- */
  /* ---------------- PUBLISH -------------------------- */
  /* -------------------------------------------------- */

  async _publishNow(queue, message) {
    if (!this.connected) {
      this._buffer(queue, message);
      return;
    }

    try {
      await this.channel.assertQueue(queue, {
        durable: true,
      });

      await this.channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true, // survive broker restart
        },
      );

      // Wait for broker confirmation
      await this.channel.waitForConfirms();
    } catch {
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
    if (!this.connected || !this.channel) {
      // Wait until connection is ready
      await new Promise((resolve) => this.once("connected", resolve));
    }

    if (!restore) this.subscriptions.set(queue, handler);

    await this.channel.assertQueue(queue, {
      durable: true,
    });

    await this.channel.consume(
      queue,
      async (msg) => {
        if (!msg) return;

        try {
          handler(JSON.parse(msg.content.toString()));
          this.channel.ack(msg);
        } catch (err) {
          this.channel.nack(msg, false, false);
        }
      },
      { noAck: false },
    );
  }

  /* -------------------------------------------------- */
  /* ---------------- SHUTDOWN ------------------------- */
  /* -------------------------------------------------- */

  async close() {
    this._closing = true;

    if (this.channel) await this.channel.close();

    if (this.conn) await this.conn.close();
  }
}

module.exports = RabbitMQAdapter;
