import {
  ObjectId,
} from 'mongodb';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class FilesController {
  static postUpload(req, res) {
    const user = this.retrieveUserBasedOnToken(req);
    if (!user) {
      res.status(401).send({
        error: 'Unauthorized',
      });
    }

    const {
      file,
    } = req.files;
    console.log(file);
  }

  static async retrieveUserBasedOnToken(req) {
    const authToken = req.headers['x-token'];
    if (!authToken) return null;
    const token = `auth_${authToken}`;
    const user = await redisClient.get(token);
    if (!user) return null;
    const users = dbClient.db.collection('users');
    const userDoc = await users.findOne({
      _id: ObjectId(user),
    });
    if (!userDoc) return null;
    return userDoc;
  }
}

export default FilesController;
