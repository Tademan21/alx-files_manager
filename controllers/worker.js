import Queue from 'bull';

const fileQueue = new Queue('Image thumbnails', 'redis://127.0.0.1:6379');

export default fileQueue;
