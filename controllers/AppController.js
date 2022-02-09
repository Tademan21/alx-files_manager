import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(req, res) {
    const redis = redisClient.isAlive();
    const db = dbClient.isAlive();
    const json = {
      redis,
      db,
    };
    res.status(200).send(json);
  }

  static async getStats(req, res) {
    const users = await dbClient.nbUsers();
    const files = await dbClient.nbFiles();
    const json = {
      users,
      files,
    };
    res.status(200).send(json);
  }
}

export default AppController;
