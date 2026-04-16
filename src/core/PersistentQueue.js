const fs = require("fs");
const path = require("path");

class PersistentQueue {
  constructor(config = {}) {
    this.dir = config.dir || "./orbit-buffer";

    this.file = path.join(this.dir, "queue.log");

    if (!fs.existsSync(this.dir))
      fs.mkdirSync(this.dir, {
        recursive: true,
      });

    if (!fs.existsSync(this.file)) fs.writeFileSync(this.file, "");
  }

  push(item) {
    fs.appendFileSync(this.file, JSON.stringify(item) + "\n");
  }

  drain(handler) {
    if (!fs.existsSync(this.file)) return;

    const lines = fs.readFileSync(this.file, "utf8").split("\n");

    const items = [];

    for (const line of lines) {
      if (!line) continue;

      items.push(JSON.parse(line));
    }

    handler(items);

    fs.writeFileSync(this.file, "");
  }
}

module.exports = PersistentQueue;
