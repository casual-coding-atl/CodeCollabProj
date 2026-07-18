import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

/**
 * ESM-native Mongoose models bound to the SAME collections the legacy Express
 * server writes to (`users`, `sessions`, `projects`). During the migration both
 * apps read/write the same data; the legacy `server/models/*.ts` files stay
 * authoritative for writes not yet migrated. These are lean projections that
 * cover exactly what the Projects slice + auth need — not a schema fork to own
 * forever, just the fields this slice touches.
 *
 * `mongoose.models.X ?? model(...)` guards against redefinition under dev HMR.
 */

// ── User ─────────────────────────────────────────────────────────────────────
const userSchema = new Schema(
  {
    username: String,
    email: String,
    role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
    permissions: [String],
    isActive: { type: Boolean, default: true },
    isSuspended: { type: Boolean, default: false },
    suspendedUntil: { type: Date },
  },
  { collection: 'users', strict: false },
);
export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ?? mongoose.model<UserDoc>('User', userSchema);

// ── Session ──────────────────────────────────────────────────────────────────
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    token: String,
    refreshToken: String,
    isActive: { type: Boolean, default: true },
    expiresAt: Date,
    lastActivity: Date,
  },
  { collection: 'sessions', strict: false },
);
export type SessionDoc = InferSchemaType<typeof sessionSchema> & { _id: mongoose.Types.ObjectId };
export const Session: Model<SessionDoc> =
  (mongoose.models.Session as Model<SessionDoc>) ??
  mongoose.model<SessionDoc>('Session', sessionSchema);

// ── Project ──────────────────────────────────────────────────────────────────
const collaboratorSchema = new Schema({
  // Legacy Express data stores the collaborator ref as `userId` (see
  // server/models/Project.ts + client `Collaborator` type). Match it exactly so
  // `.populate('collaborators.userId', ...)` and the JSON shape line up.
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
});
const projectSchema = new Schema(
  {
    title: String,
    description: String,
    technologies: [String],
    tags: [String],
    status: {
      type: String,
      enum: ['planning', 'in-progress', 'completed', 'on-hold'],
      default: 'planning',
    },
    owner: { type: Schema.Types.ObjectId, ref: 'User' },
    collaborators: [collaboratorSchema],
  },
  { collection: 'projects', strict: false, timestamps: true },
);
export type ProjectDoc = InferSchemaType<typeof projectSchema> & { _id: mongoose.Types.ObjectId };
export const Project: Model<ProjectDoc> =
  (mongoose.models.Project as Model<ProjectDoc>) ??
  mongoose.model<ProjectDoc>('Project', projectSchema);

// ── Comment ──────────────────────────────────────────────────────────────────
const commentSchema = new Schema(
  {
    content: String,
    // Legacy Express data (server/models/Comment.ts + client `Comment` type)
    // stores the author as `userId` and the project ref as `projectId`. Match
    // those names so `.populate('userId', ...)` and the JSON shape line up.
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
  },
  { collection: 'comments', strict: false, timestamps: true },
);
export type CommentDoc = InferSchemaType<typeof commentSchema> & { _id: mongoose.Types.ObjectId };
export const Comment: Model<CommentDoc> =
  (mongoose.models.Comment as Model<CommentDoc>) ??
  mongoose.model<CommentDoc>('Comment', commentSchema);

// ── Message ──────────────────────────────────────────────────────────────────
const messageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    recipient: { type: Schema.Types.ObjectId, ref: 'User' },
    subject: String,
    content: String,
    read: { type: Boolean, default: false },
  },
  { collection: 'messages', strict: false, timestamps: true },
);
export type MessageDoc = InferSchemaType<typeof messageSchema> & { _id: mongoose.Types.ObjectId };
export const Message: Model<MessageDoc> =
  (mongoose.models.Message as Model<MessageDoc>) ??
  mongoose.model<MessageDoc>('Message', messageSchema);

// ── Notification ─────────────────────────────────────────────────────────────
// New collection owned by this app (unlike the legacy-shared ones above), so it
// uses strict schema. All v1 types are Project-scoped, hence projectId is always
// set; `actor` is who caused it, `userId` is the recipient.
const NOTIFICATION_TYPES = [
  'join_requested',
  'join_accepted',
  'join_rejected',
  'collaborator_added',
  'collaborator_removed',
  'comment_posted',
] as const;
const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
    commentId: { type: Schema.Types.ObjectId, ref: 'Comment' },
    readAt: { type: Date, default: null },
  },
  { collection: 'notifications', timestamps: true },
);
notificationSchema.index({ userId: 1, createdAt: -1 }); // feed
notificationSchema.index({ userId: 1, readAt: 1 }); // unread count
export type NotificationDoc = InferSchemaType<typeof notificationSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Notification: Model<NotificationDoc> =
  (mongoose.models.Notification as Model<NotificationDoc>) ??
  mongoose.model<NotificationDoc>('Notification', notificationSchema);
