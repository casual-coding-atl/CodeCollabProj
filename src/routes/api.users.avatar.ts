import { createFileRoute } from '@tanstack/react-router';
import mongoose from 'mongoose';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB, getAvatarBucket } from '../server/db';
import { User } from '../server/models';

/**
 * /api/users/avatar
 *   POST   → store uploaded image in GridFS, set user.profileImage = fileId
 *   DELETE → remove the GridFS file and clear user.profileImage
 *
 * Images are stored in MongoDB (GridFS), so no filesystem/volume is required —
 * works on ephemeral hosts like Railway. The client's Avatar component already
 * renders a 24-hex profileImage via GET /api/users/avatar/:id.
 */

const SENSITIVE_FIELDS =
  '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

async function deleteAvatarFile(profileImage: unknown) {
  if (typeof profileImage !== 'string' || !/^[0-9a-fA-F]{24}$/.test(profileImage)) return;
  try {
    const bucket = await getAvatarBucket();
    await bucket.delete(new mongoose.Types.ObjectId(profileImage));
  } catch {
    // old file may already be gone — ignore
  }
}

export const Route = createFileRoute('/api/users/avatar')({
  server: {
    handlers: {
      POST: handler(async ({ request }) => {
        const me = await requireUser(request);
        await connectDB();

        const form = await request.formData().catch(() => null);
        const file = (form?.get('avatar') ?? form?.get('profileImage')) as File | null;
        if (!file || typeof file.arrayBuffer !== 'function')
          return error(400, 'No image file provided');
        if (file.type && !file.type.startsWith('image/'))
          return error(400, 'File must be an image');

        const buffer = Buffer.from(await file.arrayBuffer());
        if (buffer.byteLength === 0) return error(400, 'Empty file');
        if (buffer.byteLength > MAX_BYTES) return error(400, 'Image must be 5MB or smaller');

        // remove the previous avatar, if any
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

      DELETE: handler(async ({ request }) => {
        const me = await requireUser(request);
        await connectDB();
        await deleteAvatarFile(me.get('profileImage'));
        const user = await User.findByIdAndUpdate(me._id, { profileImage: null }, { new: true })
          .select(SENSITIVE_FIELDS)
          .exec();
        if (!user) return error(404, 'User not found');
        return json({ message: 'Avatar deleted successfully', user });
      }),
    },
  },
});
