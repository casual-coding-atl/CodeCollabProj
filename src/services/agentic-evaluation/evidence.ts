import type { GitHubRequester } from '../../server/github';
import { fetchRepoReadme, fetchRepoTree } from '../../server/github';

/**
 * Evidence gathered from a single linked repository.
 * Contents (readme text, paths) are only kept in memory for prompt assembly —
 * only the summary metadata is persisted to the evaluations collection.
 */
export interface RepoEvidence {
  owner: string;
  name: string;
  /** Whether the repo's README and tree were successfully fetched. */
  readable: boolean;
  /** Decoded README text, truncated to README_MAX_BYTES. Present when readable. */
  readmeText?: string;
  /** Pruned + capped file paths. Present when readable. */
  paths?: string[];
  /** Byte-length of the decoded README before truncation (summary metadata). */
  readmeBytes: number;
  /** Number of paths after pruning and capping (summary metadata). */
  fileCount: number;
}

// ── Budget constants ─────────────────────────────────────────────────────────

/** Maximum bytes kept from a single repository README (~6 KB). */
export const README_MAX_BYTES = 6_144;

/** Maximum file paths kept per repository after pruning. */
export const TREE_MAX_PATHS = 300;

/**
 * Total evidence budget across all repositories (~25 KB). The prompt assembler
 * bails out of adding more repos once this is exceeded.
 */
export const EVIDENCE_BUDGET_BYTES = 25_600;

// ── Path pruning ─────────────────────────────────────────────────────────────

/**
 * Patterns that identify vendored, generated, or otherwise low-signal paths.
 * Any path whose normalised form matches one of these is discarded.
 */
const PRUNE_PATTERNS: RegExp[] = [
  /(?:^|\/)node_modules\//,
  /(?:^|\/)\.git\//,
  /(?:^|\/)dist\//,
  /(?:^|\/)build\//,
  /(?:^|\/)\.next\//,
  /(?:^|\/)out\//,
  /(?:^|\/)coverage\//,
  /(?:^|\/)\.nyc_output\//,
  /\.min\.[cm]?js$/,
  /\.map$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /composer\.lock$/,
  /Gemfile\.lock$/,
  /Cargo\.lock$/,
  /poetry\.lock$/,
];

/**
 * Remove vendored/generated noise from a raw GitHub tree path list and cap at
 * TREE_MAX_PATHS. The input arrives in GitHub's order (BFS); that order is
 * preserved after filtering.
 */
export function pruneTree(paths: string[]): string[] {
  const kept: string[] = [];
  for (const p of paths) {
    if (kept.length >= TREE_MAX_PATHS) break;
    if (!PRUNE_PATTERNS.some((re) => re.test(p))) {
      kept.push(p);
    }
  }
  return kept;
}

/**
 * Truncate README text to at most README_MAX_BYTES, cutting at the last
 * complete UTF-8 character boundary within the limit (Buffer handles this
 * correctly because it counts bytes, not code units).
 */
export function truncateReadme(text: string): string {
  const buf = Buffer.from(text, 'utf8');
  if (buf.byteLength <= README_MAX_BYTES) return text;
  // Slice to the byte limit; toString re-encodes from bytes so no partial
  // multi-byte character leaks through.
  return buf.subarray(0, README_MAX_BYTES).toString('utf8') + '\n[…truncated]';
}

// ── Evidence gathering ───────────────────────────────────────────────────────

export interface GatherEvidenceOpts {
  token?: string;
  /** Injected in tests in place of githubRequest. */
  request?: GitHubRequester;
}

/**
 * Fetch the README and file tree for every repository ref provided.
 * Each fetch is best-effort: a network error or a 404 from GitHub marks the
 * repo as `readable: false` without failing the whole evaluation.
 *
 * @param repos Array of { owner, name } refs from the project's linkedRepos.
 * @returns Per-repo evidence with in-memory content and summary metadata.
 */
export async function gatherEvidence(
  repos: Array<{ owner: string; name: string }>,
  opts: GatherEvidenceOpts = {},
): Promise<RepoEvidence[]> {
  const results: RepoEvidence[] = [];

  for (const repo of repos) {
    const [readmeResult, treeResult] = await Promise.all([
      fetchRepoReadme(repo, opts),
      fetchRepoTree(repo, opts),
    ]);

    if (!readmeResult.ok && !treeResult.ok) {
      results.push({ owner: repo.owner, name: repo.name, readable: false, readmeBytes: 0, fileCount: 0 });
      continue;
    }

    const rawReadme = readmeResult.ok ? readmeResult.text : '';
    const readmeText = rawReadme ? truncateReadme(rawReadme) : undefined;
    const rawPaths = treeResult.ok ? treeResult.paths : [];
    const paths = rawPaths.length > 0 ? pruneTree(rawPaths) : undefined;

    results.push({
      owner: repo.owner,
      name: repo.name,
      readable: true,
      readmeText,
      paths,
      readmeBytes: Buffer.byteLength(rawReadme, 'utf8'),
      fileCount: paths?.length ?? 0,
    });
  }

  return results;
}

/**
 * Render gathered evidence into the text block that is injected into the
 * evaluation prompt. Returns an empty string when no repository was readable
 * (the caller must then omit the Reality Check instruction too).
 */
export function buildEvidenceBlock(evidence: RepoEvidence[]): string {
  const readable = evidence.filter((r) => r.readable);
  if (readable.length === 0) return '';

  const parts: string[] = [];
  let totalBytes = 0;

  for (const repo of readable) {
    const header = `### Repository: ${repo.owner}/${repo.name}\n`;
    const readmeSection = repo.readmeText
      ? `**README:**\n${repo.readmeText}\n`
      : '**README:** (not available)\n';
    const treeSection = repo.paths && repo.paths.length > 0
      ? `**File tree (${repo.paths.length} paths):**\n${repo.paths.join('\n')}\n`
      : '**File tree:** (not available)\n';

    const block = header + readmeSection + '\n' + treeSection;
    const blockBytes = Buffer.byteLength(block, 'utf8');

    if (totalBytes + blockBytes > EVIDENCE_BUDGET_BYTES) break;
    parts.push(block);
    totalBytes += blockBytes;
  }

  if (parts.length === 0) return '';
  return '## Repository Evidence\n\n' + parts.join('\n---\n\n');
}
