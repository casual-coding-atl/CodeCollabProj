import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser, query } from '../server/http';
import { connectDB } from '../server/db';
import { User, Message } from '../server/models';

/**
 * /api/users/messages
 *   GET  → userController.getMessages  (auth) — `?type=sent` lists messages the
 *          current user SENT; anything else (default `inbox`) lists RECEIVED.
 *   POST → userController.sendMessage  (auth + messageValidator)
 *
 * Both handlers populate sender + recipient with `'username firstName lastName'`.
 * GET sorts newest-first and returns `Message[]`. POST returns the created,
 * populated message with `201`.
 */

type FieldError = { type: string; msg: string; path: string; location: string };
const fieldError = (path: string, msg: string): FieldError => ({
  type: 'field',
  msg,
  path,
  location: 'body',
});

const isMongoId = (v: unknown): boolean => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);

export const Route = createFileRoute('/api/users/messages')({
  server: {
    handlers: {
      GET: handler(async ({ request }) => {
        const me = await requireUser(request);
        await connectDB();

        const type = query(request).get('type') ?? 'inbox';
        const filter =
          type === 'sent' ? { sender: me._id } : { recipient: me._id };

        const messages = await Message.find(filter)
          .populate('sender', 'username firstName lastName')
          .populate('recipient', 'username firstName lastName')
          .sort({ createdAt: -1 })
          .exec();

        return json(messages);
      }),

      POST: handler(async ({ request }) => {
        const me = await requireUser(request);
        await connectDB();

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

        // Mirror messageValidator.
        const errors: FieldError[] = [];
        const recipientId = body.recipientId;
        const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
        const content = typeof body.content === 'string' ? body.content.trim() : '';

        if (recipientId === undefined || recipientId === null || recipientId === '') {
          errors.push(fieldError('recipientId', 'Recipient ID is required'));
        } else if (!isMongoId(recipientId)) {
          errors.push(fieldError('recipientId', 'Invalid recipient ID'));
        }
        if (!subject) {
          errors.push(fieldError('subject', 'Message subject is required'));
        } else if (subject.length < 1 || subject.length > 100) {
          errors.push(fieldError('subject', 'Subject must be between 1 and 100 characters'));
        }
        if (!content) {
          errors.push(fieldError('content', 'Message content is required'));
        } else if (content.length < 1 || content.length > 1000) {
          errors.push(fieldError('content', 'Message must be between 1 and 1000 characters'));
        }
        if (errors.length > 0) return json({ errors }, 400);

        const recipient = await User.findById(recipientId as string).exec();
        if (!recipient) return error(404, 'Recipient not found');

        if (!recipient.get('isProfilePublic')) {
          return error(403, 'Cannot send message to private profile');
        }

        const message = new Message({
          sender: me._id,
          recipient: recipientId,
          subject,
          content,
        });

        await message.save();
        await message.populate('sender', 'username firstName lastName');
        await message.populate('recipient', 'username firstName lastName');

        return json(message, 201);
      }),
    },
  },
});
