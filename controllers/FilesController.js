import {
  ObjectId,
} from 'mongodb';
import {
  env,
} from 'process';
import {
  v4 as uuidv4,
} from 'uuid';
import path from 'path';
import mime from 'mime-types';
import fs from 'fs';
// import { promisify } from 'util';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

/**
 * @class FilesController
 * @description Controller for files related operations
 * @exports FilesController
 */
class FilesController {
  /**
   * @method postUpload
   * @description Uploads a file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
  static async postUpload(req, res) {
    const user = FilesController.retrieveUserBasedOnToken(req);
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

      const newFile = {
        name,
        type,
        parentId: parentId || 0,
        isPublic: isPublic || false,
        userId,
        localPath: filePath,
      };
      // Create directory if not exists
      if (!(await FilesController.pathExists(storeFolderPath))) {
        await fs.mkdir(storeFolderPath, { recursive: true });
        FilesController.writeToFile(res, filePath, data, newFile);
      } else {
        FilesController.writeToFile(res, filePath, data, newFile);
      }
    }
  }

  static async writeToFile(res, filePath, data, newFile) {
    const file = fs.createWriteStream(filePath);
    file.write(data);
    file.end();
    const files = dbClient.db.collection('files');
    const result = await files.insertOne(newFile);
    const fres = {
      ...newFile,
      id: result.insertedId,
    };
    res.status(201).send(fres);
  }

  /**
   * @method retrieveUserBasedOnToken
   * @description retrieve user based on auth token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
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

  /**
   * @method getShow
   * @description retrieve files based on id
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
  static async getShow(req, res) {
    const {
      id,
    } = req.params;
    const user = FilesController.retrieveUserBasedOnToken(req);
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

  /**
   * @method getIndex
   * @description retrieve files based on parentid and pagination
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
  static async getIndex(req, res) {
    const user = FilesController.retrieveUserBasedOnToken(req);
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

  /**
   * @method putPublish
   * @description set isPublic to true on the file document based on the ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
  static putPublish(req, res) {
    this.pubSubHelper(req, res, true);
  }

  /**
   * @method putUnpublish
   * @description set isPublic to false on the file document based on the ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
  static putUnpublish(req, res) {
    this.pubSubHelper(req, res, false);
  }

  /**
   * @method pubSubHelper
   * @description helper method for @putPublish and @putUnpublish
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Boolean} isPublic - isPublic value to set
   * @returns {Object} - Express response object
   */
  static async pubSubHelper(req, res, updateValue) {
    const {
      id,
    } = req.params;
    const user = FilesController.retrieveUserBasedOnToken(req);
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
      const update = {
        $set: {
          isPublic: updateValue,
        },
      };
      const result = await files.updateOne({
        _id: ObjectId(id),
      }, update);
      res.status(200).send(result);
    }
  }

  /**
   * @method getFile
   * @description return the content of the file document based on the ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Express response object
   */
  static async getFile(req, res) {
    const {
      id,
    } = req.params;
    const user = FilesController.retrieveUserBasedOnToken(req);
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
    if (!file && file.isPublic === false) {
      res.status(404).send({
        error: 'Not found',
      });
    } else if (file.type === 'folder') {
      res.status(400).send({
        error: 'A folder doesn\'t have content',
      });
    } else {
      // check if file exists
      fs.access(file.localPath, fs.constants.F_OK, (err) => {
        if (err) {
          res.status(404).send({
            error: 'Not found',
          });
        } else {
          const mimeType = mime.lookup(path.extname(file.localPath));
          res.contentType(mimeType).sendFile(file.localPath);
        }
      });
    }
  }

  static pathExists(path) {
    return new Promise((resolve) => {
      fs.access(path, fs.constants.F_OK, (err) => {
        resolve(!err);
      });
    });
  }
}

export default FilesController;
