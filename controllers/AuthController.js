import {
  createHash,
} from 'crypto';
import {
  v4 as uuidv4,
} from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

/**
 * @class UsersController
 * @description This class handles all authorization related requests
 */
class Authorization {
  /**
   * @param {object} req
   * @param {object} res
   * @returns {object} user
   * @description This method creates a new user
   */
  static async getConnect(req, res) {
    const authToken = req.headers.authorization;
    if (!authToken) {
      res.status(401).send({
        error: 'Missing authorization token',
      });
    }

    // decode authToken from base64 to utf8 to get email and password
    const authTokenDecoded = Buffer.from(authToken.split(' ')[1], 'base64').toString('utf8');
    const [email, password] = authTokenDecoded.split(':');

    // check if user exists
    const hash = createHash('sha256').update(password).digest('hex');
    const collection = dbClient.db.collection('users');
    const user = await collection.findOne({
      email,
      password: hash,
    });
    if (!user) {
      res.status(401).send({
        error: 'Unauthorized',
      });
      return;
    }

    // generate new token
    const token = uuidv4();
    const key = `auth_${token}`;
    const userID = user._id.toString();
    await redisClient.set(key, userID, (60 * 60 * 24)); // 1 day
    res.status(200).send({
      token,
    });
  }

  /**
   * @param {object} req
   * @param {object} res
   * @returns {object} user
   * @description This method creates a new user
   */
  static async getDisconnect(req, res) {
    let authToken = req.headers['x-token'];
    if (!authToken) {
      res.status(401).send({
        error: 'Missing authorization token',
      });
      return;
    }
    authToken = `auth_${authToken}`;
    const user = await redisClient.get(authToken);
    if (!user) {
      res.status(401).send({
        error: 'Unauthorized',
      });
      return;
    }
    await redisClient.del(authToken);
    res.status(204).send();
  }

  /**
   * @param {object} req
   * @param {object} res
   * @returns {object} user
   * @description This method retrieves user data based on user based token
   */
  static async getUser(req, res) {
    let authToken = req.headers['X-Token'];
    if (!authToken) {
      res.status(401).send({
        error: 'Missing authorization token',
      });
    }
    authToken = `auth_${authToken}`;
    const user = await redisClient.get(authToken);
    if (!user) {
      res.status(401).send({
        error: 'Unauthorized',
      });
    }
    res.status(200).send({
      user,
    });
  }
}

export default Authorization;
