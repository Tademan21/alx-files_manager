import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(req, res) {
    const json = {
      redis: redisClient.isAlive(),
      db: dbClient.isAlive(),
    };
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(json);
  }

  static async getStats(req, res) {
    const users = await dbClient.nbUsers();
    const files = await dbClient.nbFiles();
    const json = {
      users,
      files,
    };
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(json);
  }
}

export default AppController;
