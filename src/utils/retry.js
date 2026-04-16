module.exports = async function retry(fn, options = {}) {
  const retries = options.retries || Infinity;
  const delay = options.delay || 1000;
  const factor = options.factor || 2;

  let attempt = 0;

  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;

      const wait = delay * Math.pow(factor, attempt);

      await new Promise((r) => setTimeout(r, wait));
    }
  }
};
