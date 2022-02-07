/**
 * Contains redis client class and some helper functions
 */
import {
  createClient,
} from 'redis';
import {
  promisify,
} from 'util';

class RedisClient {
  constructor() {
    this.client = createClient();
    this.client.on('error', (err) => {
      console.log(err.message);
    });
  }

  isAlive() {
    return (!!this.client);
  }

  async get(key) {
    const getAsync = promisify(this.client.get).bind(this.client);
    const result = await getAsync(key);
    return result;
  }

  async set(key, value, duration) {
    const setAsync = promisify(this.client.set).bind(this.client);
    const result = await setAsync(key, value, 'EX', duration);
    return result;
  }

  async del(key) {
    const delAsync = promisify(this.client.del).bind(this.client);
    const result = await delAsync(key);
    return result;
  }
}

const redisClient = new RedisClient();

export default redisClient;
