import {
  ObjectId,
} from 'mongodb';
import {
  env,
} from 'process';
import {
  v4 as uuidv4,
} from 'uuid';
import fs from 'fs';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class FilesController {
  static async postUpload(req, res) {
    const user = this.retrieveUserBasedOnToken(req);
    if (!user) {
      res.status(401).send({
        error: 'Unauthorized',
      });
    }
    const acceptedTypes = ['folder', 'file', 'image'];
    const {
      name,
      type,
      parentId,
      isPublic,
      data,
    } = req.body;

    if (!name) {
      res.status(400).send({
        error: 'Missing name',
      });
      return;
    }

    if ((!type || !acceptedTypes.includes(type))) {
      res.status(400).send({
        error: 'Missing type',
      });
      return;
    }

    if (!data && type !== 'folder') {
      res.status(400).send({
        error: 'Missing data',
      });
      return;
    }

    if (parentId) {
      const files = dbClient.db.collection('files');
      const parent = await files.findOne({
        _id: ObjectId(parentId),
      });
      if (!parent) {
        res.status(400).send({
          error: 'Parent not found',
        });
        return;
      }
      if (parent.type !== 'folder') {
        res.status(400).send({
          error: 'Parent is not a folder',
        });
        return;
      }
    }

    const userId = user._id;
    if (type === 'folder') {
      const files = dbClient.db.collection('files');
      const newFile = {
        name,
        type,
        parentId: parentId || 0,
        isPublic: isPublic || false,
        userId,
      };
      const result = await files.insertOne(newFile);
      newFile.id = result.insertedId;
      res.status(201).send(newFile);
    } else {
      const storeFolderPath = env.FOLDER_PATH || '/tmp/files_manager';
      const fileName = uuidv4();
      const filePath = `${storeFolderPath}/${fileName}`;
      await fs.writeFile(filePath, data, 'utf-8');
      const files = dbClient.db.collection('files');
      const newFile = {
        name,
        type,
        parentId: parentId || 0,
        isPublic: isPublic || false,
        userId,
        localPath: filePath,
      };
      const result = await files.insertOne(newFile);
      newFile.id = result.insertedId;
      res.status(201).send(newFile);
    }
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
