import mongoose, { Connection } from 'mongoose';
import { GridFSBucket, GridFSBucketReadStream, ObjectId } from 'mongodb';

/**
 * GridFS file metadata
 */
interface GridFSFileMetadata {
  uploadedAt: Date;
  [key: string]: unknown;
}

/**
 * GridFS file info structure
 */
interface GridFSFileInfo {
  _id: ObjectId;
  length: number;
  chunkSize: number;
  uploadDate: Date;
  filename: string;
  contentType?: string;
  metadata?: GridFSFileMetadata;
}

let avatarBucket: GridFSBucket | null = null;

/**
 * Initialize the GridFS bucket for avatar storage
 * Must be called after MongoDB connection is established
 */
const initGridFS = (connection: Connection): GridFSBucket => {
  if (!connection || !connection.db) {
    throw new Error('MongoDB connection not available');
  }

  avatarBucket = new GridFSBucket(connection.db, {
    bucketName: 'avatars',
  });

  return avatarBucket;
};

/**
 * Get the GridFS bucket instance
 */
const getBucket = (): GridFSBucket => {
  if (!avatarBucket) {
    throw new Error('GridFS bucket not initialized. Call initGridFS first.');
  }
  return avatarBucket;
};

/**
 * Upload a file buffer to GridFS
 * @param buffer - The file buffer
 * @param filename - The filename to store
 * @param mimetype - The file MIME type
 * @returns The GridFS file ID
 */
const uploadToGridFS = (buffer: Buffer, filename: string, mimetype: string): Promise<ObjectId> => {
  return new Promise((resolve, reject) => {
    const bucket = getBucket();

    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimetype,
      metadata: {
        uploadedAt: new Date(),
      },
    });

    uploadStream.on('error', (error: Error) => {
      reject(error);
    });

    uploadStream.on('finish', () => {
      resolve(uploadStream.id as ObjectId);
    });

    uploadStream.end(buffer);
  });
};

/**
 * Download a file from GridFS
 * @param fileId - The GridFS file ID
 * @returns A readable stream of the file
 */
const downloadFromGridFS = (fileId: ObjectId | string): GridFSBucketReadStream => {
  const bucket = getBucket();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;

  return bucket.openDownloadStream(objectId as unknown as ObjectId);
};

/**
 * Delete a file from GridFS
 * @param fileId - The GridFS file ID
 */
const deleteFromGridFS = async (fileId: ObjectId | string): Promise<void> => {
  const bucket = getBucket();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;

  await bucket.delete(objectId as unknown as ObjectId);
};

/**
 * Get file metadata from GridFS
 * @param fileId - The GridFS file ID
 * @returns File metadata or null if not found
 */
const getFileInfo = async (fileId: ObjectId | string): Promise<GridFSFileInfo | null> => {
  const bucket = getBucket();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;

  const files = await bucket.find({ _id: objectId as unknown as ObjectId }).toArray();
  return files.length > 0 ? (files[0] as GridFSFileInfo) : null;
};

module.exports = {
  initGridFS,
  getBucket,
  uploadToGridFS,
  downloadFromGridFS,
  deleteFromGridFS,
  getFileInfo,
};

export { GridFSFileInfo, GridFSFileMetadata };
