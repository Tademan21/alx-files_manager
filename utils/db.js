import {
  MongoClient,
} from 'mongodb';
import {
  env,
} from 'process';

class DBClient {
  constructor() {
    this.host = env.DB_HOST || 'localhost';
    this.port = env.DB_PORT || 27017;
    this.dbName = env.DB_DATABASE || 'files_manager';
    MongoClient(`mongodb://${this.host}:${this.port}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }).connect().then((client) => {
      this.client = client;
      this.db = this.client.db(this.dbName);
    }).catch((err) => {
      console.error(err.message);
    });
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    const collection = this.db.collection('users');
    const nb = await collection.countDocuments();
    return nb;
  }

  async nbFiles() {
    const collection = this.db.collection('files');
    const nb = await collection.countDocuments();
    return nb;
  }
}

const dbClient = new DBClient();

export default dbClient;
