const { randomUUID } = require('crypto');

module.exports = {
  nanoid: (size = 21) => randomUUID().replace(/-/g, '').slice(0, size),
};
