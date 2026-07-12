import { createFileRoute } from '@tanstack/react-router';
import mongoose from 'mongoose';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB, getAvatarBucket } from '../server/db';
import { User } from '../server/models';

/**
 * POST /api/users/profile/image  (auth) — alias of the avatar upload used by
 * `usersService.uploadProfileImage` (posts a `profileImage` file). Stores the
 * image in GridFS and sets user.profileImage = fileId, same as /api/users/avatar.
 */

const SENSITIVE_FIELDS =
  '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires';
const MAX_BYTES = 5 * 1024 * 1024;

async function deleteAvatarFile(profileImage: unknown) {
  if (typeof profileImage !== 'string' || !/^[0-9a-fA-F]{24}$/.test(profileImage)) return;
  try {
    const bucket = await getAvatarBucket();
    await bucket.delete(new mongoose.Types.ObjectId(profileImage));
  } catch {
    /* ignore */
  }
}

export const Route = createFileRoute('/api/users/profile/image')({
  server: {
    handlers: {
      POST: handler(async ({ request }) => {
        const me = await requireUser(request);
        await connectDB();

        const form = await request.formData().catch(() => null);
        const file = (form?.get('profileImage') ?? form?.get('avatar')) as File | null;
        if (!file || typeof file.arrayBuffer !== 'function')
          return error(400, 'No image file provided');
        if (file.type && !file.type.startsWith('image/'))
          return error(400, 'File must be an image');

        const buffer = Buffer.from(await file.arrayBuffer());
        if (buffer.byteLength === 0) return error(400, 'Empty file');
        if (buffer.byteLength > MAX_BYTES) return error(400, 'Image must be 5MB or smaller');

        await deleteAvatarFile(me.get('profileImage'));

        const bucket = await getAvatarBucket();
        const uploadStream = bucket.openUploadStream(file.name || `avatar-${me._id}`, {
          contentType: file.type || 'image/png',
          metadata: { userId: String(me._id) },
        });
        const fileId = uploadStream.id;
        await new Promise<void>((resolve, reject) => {
          uploadStream.on('finish', () => resolve());
          uploadStream.on('error', reject);
          uploadStream.end(buffer);
        });

        const user = await User.findByIdAndUpdate(
          me._id,
          { profileImage: String(fileId) },
          { new: true },
        )
          .select(SENSITIVE_FIELDS)
          .exec();

        return json({
          message: 'Avatar uploaded successfully',
          profileImage: String(fileId),
          avatar: String(fileId),
          user,
        });
      }),
    },
  },
});
