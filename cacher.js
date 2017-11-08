const level = require('level');

class Cacher {
  constructor(dbPath, fetchMethod, keyBuilder = (x => x)) {
    this.cache = level(dbPath);
    this.fetchMethod = fetchMethod;
    this.keyBuilder = keyBuilder;
  }

  get(data) {
    const key = this.keyBuilder(data);
    return this.cache.get(key)
      .then(str => JSON.parse(str))
      .catch(err => {
        if (err.type !== 'NotFoundError') throw err;
        return this.fetchMethod(data)
          .then(result => {
            // this.cache.put(key, JSON.stringify(result));
            return result;
          })
          .catch(err => { throw err; });
      });
  }
}

module.exports = Cacher;
