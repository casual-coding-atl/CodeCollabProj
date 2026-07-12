import { createFileRoute } from '@tanstack/react-router';
import mongoose from 'mongoose';
import { handler, error } from '../server/http';
import { getAvatarBucket } from '../server/db';

/**
 * GET /api/users/avatar/$id — stream an avatar image out of GridFS.
 * Public (avatars are shown wherever a user appears). The client's Avatar
 * component points here when profileImage is a 24-hex GridFS id.
 */
export const Route = createFileRoute('/api/users/avatar/$id')({
  server: {
    handlers: {
      GET: handler(async ({ params }) => {
        if (!/^[0-9a-fA-F]{24}$/.test(params.id)) return error(400, 'Invalid avatar id');
        const _id = new mongoose.Types.ObjectId(params.id);
        const bucket = await getAvatarBucket();

        const files = await bucket.find({ _id }).toArray();
        if (!files.length) return error(404, 'Avatar not found');

        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          bucket
            .openDownloadStream(_id)
            .on('data', (c: Buffer) => chunks.push(c))
            .on('end', () => resolve())
            .on('error', reject);
        });

        return new Response(Buffer.concat(chunks), {
          status: 200,
          headers: {
            'content-type': files[0].contentType || 'image/png',
            'cache-control': 'public, max-age=86400',
          },
        });
      }),
    },
  },
});
