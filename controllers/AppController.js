import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(_req, res) {
    const redis = redisClient.isAlive();
    const db = dbClient.isAlive();
    const json = {
      redis,
      db,
    };
    res.status(200);
    res.send(json);
  }

  static async getStats(_req, res) {
    const json = {
      users: await dbClient.nbUsers(),
      files: await dbClient.nbFiles(),
    };
    res.status(200);
    res.send(json);
  }
}

export default AppController;
