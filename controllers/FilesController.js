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
      return;
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

  static async getShow(req, res) {
    const {
      id,
    } = req.params;
    const user = this.retrieveUserBasedOnToken(req);
    if (!user) {
      res.status(401).send({
        error: 'Unauthorized',
      });
      return;
    }

    const files = dbClient.db.collection('files');
    const file = await files.findOne({
      userId: user._id,
      _id: ObjectId(id),
    });
    if (!file) {
      res.status(404).send({
        error: 'Not found',
      });
    } else {
      res.status(200).send(file);
    }
  }

  static async getIndex(req, res) {
    const user = this.retrieveUserBasedOnToken(req);
    if (!user) {
      res.status(401).send({
        error: 'Unauthorized',
      });
      return;
    }
    const {
      parentId,
      page,
    } = req.query;
    const files = dbClient.db.collection('files');

    // Check for parent existence dependingon user and type
    const parentFolder = await files.findOne({
      _id: ObjectId(parentId),
      userId: user._id,
      type: 'folder',
    });
    if (!parentFolder) {
      res.send([]);
    }

    // Perform pagination
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    // Perform query

    const query = {
      userId: user._id,
      parentId: parentId || 0,
    };

    // handle pagination using aggregation
    const result = await files.aggregate([
      {
        $match: query,
      },
      {
        $sort: {
          name: 1,
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: pageSize,
      },
    ]).toArray();

    res.send(result);
  }

  // static putPublish(req, res) {}

  // static putUnpublish(req, res) {}
}

export default FilesController;
