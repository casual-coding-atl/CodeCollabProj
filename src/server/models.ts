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
// Better Auth owns sessions (ADR 0002) and writes them to the singular `session`
// collection; the legacy `sessions` collection is retired. This model exists
// only so the admin panel can still count and revoke them — Better Auth's own
// API is the way to *create* or validate one. `userId` is Mixed because the
// adapter may store it as an ObjectId or as its string form.
const sessionSchema = new Schema(
  {
    userId: Schema.Types.Mixed,
    token: String,
    expiresAt: Date,
  },
  { collection: 'session', strict: false },
);
export type SessionDoc = InferSchemaType<typeof sessionSchema> & { _id: mongoose.Types.ObjectId };
export const Session: Model<SessionDoc> =
  (mongoose.models.Session as Model<SessionDoc>) ??
  mongoose.model<SessionDoc>('Session', sessionSchema);

/**
 * Every row belonging to a member, whichever way the adapter stored the id
 * (Better Auth writes it as an ObjectId or as its string form depending on the
 * path). Works for any of the auth-owned collections below.
 */
export function ownedBy(userId: string | mongoose.Types.ObjectId) {
  const id = String(userId);
  const or: Array<Record<string, unknown>> = [{ userId: id }];
  if (mongoose.Types.ObjectId.isValid(id)) or.push({ userId: new mongoose.Types.ObjectId(id) });
  return { $or: or };
}

// ── Account / Passkey ────────────────────────────────────────────────────────
// The other two collections Better Auth keys off a member: `account` holds the
// password credential and any linked OAuth tokens, `passkey` the registered
// WebAuthn credentials. Nothing here creates them — these models exist so
// deleting a member takes their sign-in secrets with them instead of leaving
// orphaned credentials behind a recycled ObjectId.
const accountSchema = new Schema(
  { userId: Schema.Types.Mixed, providerId: String, accountId: String },
  { collection: 'account', strict: false },
);
export type AccountDoc = InferSchemaType<typeof accountSchema> & { _id: mongoose.Types.ObjectId };
export const Account: Model<AccountDoc> =
  (mongoose.models.Account as Model<AccountDoc>) ??
  mongoose.model<AccountDoc>('Account', accountSchema);

const passkeySchema = new Schema(
  { userId: Schema.Types.Mixed, name: String },
  { collection: 'passkey', strict: false },
);
export type PasskeyDoc = InferSchemaType<typeof passkeySchema> & { _id: mongoose.Types.ObjectId };
export const Passkey: Model<PasskeyDoc> =
  (mongoose.models.Passkey as Model<PasskeyDoc>) ??
  mongoose.model<PasskeyDoc>('Passkey', passkeySchema);

// ── Project ──────────────────────────────────────────────────────────────────
const collaboratorSchema = new Schema({
  // Legacy Express data stores the collaborator ref as `userId` (see
  // server/models/Project.ts + client `Collaborator` type). Match it exactly so
  // `.populate('collaborators.userId', ...)` and the JSON shape line up.
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
});
/**
 * A Linked Repository (CONTEXT.md): a public GitHub repo attached to a project
 * by its owner, at most three per project. `repoId` is GitHub's numeric id — the
 * identity that survives a rename — while `owner`/`name` are a cached label,
 * refreshed from GitHub's responses whenever they drift.
 */
const linkedRepoSchema = new Schema(
  {
    repoId: { type: Number, required: true },
    owner: { type: String, required: true },
    name: { type: String, required: true },
    linkedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);
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
    linkedRepos: [linkedRepoSchema],
  },
  { collection: 'projects', strict: false, timestamps: true },
);
// "Is this repository linked to any project?" — asked on every repo-card
// request, before a single byte goes to GitHub (see findLinkedRepo in
// ./repo-linking), so it must not be a collection scan.
projectSchema.index({ 'linkedRepos.owner': 1, 'linkedRepos.name': 1 });
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

// ── GitHub cache ─────────────────────────────────────────────────────────────
// Responses from api.github.com, keyed by normalized API path (PRD #88). The
// data is public, so one entry serves every visitor.
//
// Two timestamps, deliberately: `fetchedAt` is what *freshness* is measured
// from (ten minutes for a repo card), while `expiresAt` — a day later — is
// where Mongo's TTL index reaps the document. Entries therefore outlive their
// freshness, which is what lets a rate-limited or unreachable GitHub degrade a
// card to slightly-stale rather than unavailable. The read logic lives in
// ./github-cache.
const githubCacheSchema = new Schema(
  {
    path: { type: String, required: true, unique: true },
    status: { type: Number, required: true },
    body: { type: String, required: true },
    fetchedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'github_cache' },
);
githubCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type GithubCacheDoc = InferSchemaType<typeof githubCacheSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const GithubCache: Model<GithubCacheDoc> =
  (mongoose.models.GithubCache as Model<GithubCacheDoc>) ??
  mongoose.model<GithubCacheDoc>('GithubCache', githubCacheSchema);

// ── Evaluation ────────────────────────────────────────────────────────────────
// Phase 1: ideation evaluation. Up to MAX_EVALUATIONS_PER_TYPE documents are
// kept per (projectId, agentType) pair; the oldest is deleted when a new one
// would exceed the cap (enforced in the route handler, not here).
export const MAX_EVALUATIONS_PER_TYPE = 3;

// Summary metadata for one repository's evidence (contents not stored).
const evidenceRepoSchema = new Schema(
  {
    owner: { type: String, required: true },
    name: { type: String, required: true },
    readable: { type: Boolean, required: true },
    /** Byte-length of the decoded README before truncation (0 when unavailable). */
    readmeBytes: { type: Number, default: 0 },
    /** Number of file paths after pruning and capping (0 when unavailable). */
    fileCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const evaluationFindingSchema = new Schema(
  {
    dimension: { type: String, required: true },
    assessment: { type: String, required: true },
    suggestion: { type: String },
  },
  { _id: false },
);

const ideationFindingsSchema = new Schema(
  {
    summary: { type: String, required: true },
    findings: [evaluationFindingSchema],
    actionItems: [String],
    readinessScore: { type: Number, min: 1, max: 5, required: true },
  },
  { _id: false },
);

const ideationInputSchema = new Schema(
  {
    problemStatement: { type: String, required: true },
    targetAudience: { type: String, required: true },
    coreFeatures: { type: String, required: true },
    techApproach: { type: String },
    repositoryUrl: { type: String },
    successMetrics: { type: String, required: true },
    timelineAndConstraints: { type: String, required: true },
    risksAndQuestions: { type: String, required: true },
  },
  { _id: false },
);

const EVALUATION_AGENT_TYPES = ['ideation'] as const;
const EVALUATION_STATUSES = ['pending', 'completed', 'failed'] as const;

const evaluationSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    agentType: { type: String, enum: EVALUATION_AGENT_TYPES, required: true },
    status: { type: String, enum: EVALUATION_STATUSES, default: 'pending' },
    input: { type: ideationInputSchema, required: true },
    findings: { type: ideationFindingsSchema },
    /** Summary metadata for each linked repo that was checked (contents not stored). */
    evidence: { type: [evidenceRepoSchema], default: undefined },
    userNotes: { type: String },
    requestedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { collection: 'evaluations', timestamps: false },
);
// Feed: list evaluations for a project newest-first.
evaluationSchema.index({ projectId: 1, agentType: 1, requestedAt: -1 });
// Cap enforcement: find the oldest doc when trimming to MAX_EVALUATIONS_PER_TYPE.
evaluationSchema.index({ projectId: 1, agentType: 1, requestedAt: 1 });

export type EvaluationDoc = InferSchemaType<typeof evaluationSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const Evaluation: Model<EvaluationDoc> =
  (mongoose.models.Evaluation as Model<EvaluationDoc>) ??
  mongoose.model<EvaluationDoc>('Evaluation', evaluationSchema);
