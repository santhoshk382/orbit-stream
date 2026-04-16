const Redis = require("ioredis");
const StreamClient = require("../core/StreamClient");
const ConnectionManager = require("../core/ConnectionManager");

const DEFAULT_MAXLEN = 1000000;

class ValkeyAdapter extends StreamClient {
  async connect() {
    this._closing = false;

    this.connectionManager = new ConnectionManager(async () => {
      this.redis = new Redis({
        host: this.config.host,
        port: this.config.port,

        enableAutoPipelining: true,

        // Disable internal retry logic
        retryStrategy: () => null,
        reconnectOnError: () => false,
        enableOfflineQueue: false,
        autoResendUnfulfilledCommands: false,
        autoResubscribe: false,
        maxRetriesPerRequest: 0,
      });

      // WAIT UNTIL REDIS IS FULLY READY
      await new Promise((resolve, reject) => {
        this.redis.once("ready", resolve);
        this.redis.once("error", reject);
      });

      this.redis.on("error", (err) => {
        if (this.listenerCount("error") > 0) this.emit("error", err);
      });

      this.redis.on("close", () => {
        this.connected = false;
        if (!this._closing) this.connectionManager.scheduleReconnect();
      });

      this.redis.on("end", () => {
        this.connected = false;
      });
    }, this.config);

    this.connectionManager.on("connected", async () => {
      this.connected = true;

      await this.flushPersistentQueue();
      await this.flushOfflineQueue();

      this.emit("connected");
    });

    this.connectionManager.on("reconnecting", (delay) =>
      this.emit("reconnecting", delay),
    );
  }

  /* -------------------------------------------------- */
  /* ---------------- SINGLE PUBLISH ------------------ */
  /* -------------------------------------------------- */

  async _publishNow(stream, message, options = {}) {
    if (!this.connected) {
      this._buffer(stream, message, options);
      return;
    }

    const { maxLen = DEFAULT_MAXLEN, approximate = true } = options;

    const payload =
      message instanceof Buffer ? message : JSON.stringify(message);

    const args = [stream];

    if (maxLen !== null) {
      args.push("MAXLEN", approximate ? "~" : "=", maxLen);
    }

    args.push("*", "data", payload);

    try {
      await this.redis.xadd(...args);
    } catch {
      this._buffer(stream, message, options);
    }
  }

  /* -------------------------------------------------- */
  /* ---------------- BATCH PUBLISH ------------------- */
  /* -------------------------------------------------- */

  async publishBatch(stream, messages, options = {}) {
    if (!this.connected) {
      this._bufferBatch(stream, messages, options);
      return;
    }

    const { maxLen = DEFAULT_MAXLEN, approximate = true } = options;

    try {
      const pipeline = this.redis.pipeline();

      for (const message of messages) {
        const payload =
          message instanceof Buffer ? message : JSON.stringify(message);

        const args = [stream];

        if (maxLen !== null) {
          args.push("MAXLEN", approximate ? "~" : "=", maxLen);
        }

        args.push("*", "data", payload);

        pipeline.xadd(...args);
      }

      await pipeline.exec();
    } catch {
      this._bufferBatch(stream, messages, options);
    }
  }

  _buffer(stream, message, options) {
    const item = {
      channel: stream,
      message,
      options,
    };

    this.offlineQueue.push(item);
    this.persistentQueue.push(item);
  }

  _bufferBatch(stream, messages, options) {
    for (const message of messages) {
      this._buffer(stream, message, options);
    }

    this.emit("bufferedBatch", messages.length);
  }

  /* -------------------------------------------------- */
  /* ---------------- SUBSCRIBE ----------------------- */
  /* -------------------------------------------------- */

  async subscribe(stream, handler, restore = false) {
    if (!restore) this.subscriptions.set(stream, handler);

    if (!this._lastIds) this._lastIds = new Map();

    if (!this._lastIds.has(stream)) {
      const startFrom = this.config.startFrom === "latest" ? "$" : "0-0";

      this._lastIds.set(stream, startFrom);
    }

    const getLastId = () => this._lastIds.get(stream);

    const setLastId = (id) => this._lastIds.set(stream, id);

    const createReader = () => {
      const redis = new Redis({
        host: this.config.host,
        port: this.config.port,
        retryStrategy: () => 1000,
      });

      redis.on("error", () => {});

      return redis;
    };

    let redis = createReader();

    while (!this._closing) {
      try {
        const result = await redis.xread(
          "BLOCK",
          5000,
          "COUNT",
          1000,
          "STREAMS",
          stream,
          getLastId(),
        );

        if (!result) continue;

        const messages = result[0][1];

        for (const msg of messages) {
          const id = msg[0];

          setLastId(id);

          handler(JSON.parse(msg[1][1]));
        }
      } catch {
        await new Promise((r) => setTimeout(r, 1000));

        redis.disconnect();
        redis = createReader();
      }
    }
  }

  /* -------------------------------------------------- */
  /* ---------------- SHUTDOWN ------------------------ */
  /* -------------------------------------------------- */

  async close() {
    this._closing = true;

    if (this.redis) await this.redis.quit();
  }
}

module.exports = ValkeyAdapter;
