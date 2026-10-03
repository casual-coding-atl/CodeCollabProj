import { describe, it, expect, vi } from 'vitest';
import {
  truncateReadme,
  pruneTree,
  gatherEvidence,
  buildEvidenceBlock,
  README_MAX_BYTES,
  TREE_MAX_PATHS,
  EVIDENCE_BUDGET_BYTES,
} from './evidence';

// ── truncateReadme ────────────────────────────────────────────────────────────

describe('truncateReadme', () => {
  it('returns the original text when it is within the byte limit', () => {
    const text = 'Hello, world!';
    expect(truncateReadme(text)).toBe(text);
  });

  it('truncates text that exceeds README_MAX_BYTES', () => {
    const text = 'a'.repeat(README_MAX_BYTES + 100);
    const result = truncateReadme(text);
    expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(README_MAX_BYTES + 20); // +20 for truncation marker
    expect(result).toMatch(/\[…truncated\]$/);
  });

  it('truncates exactly at the byte limit, not the character limit', () => {
    // A string of exactly README_MAX_BYTES ASCII chars should pass through unchanged.
    const exact = 'x'.repeat(README_MAX_BYTES);
    expect(truncateReadme(exact)).toBe(exact);
  });

  it('does not produce invalid UTF-8 when cutting through multi-byte characters', () => {
    // '€' is 3 bytes in UTF-8. Fill to just over the limit with euro signs.
    const euros = '€'.repeat(Math.ceil((README_MAX_BYTES + 10) / 3));
    const result = truncateReadme(euros);
    // Must be valid UTF-8: no replacement characters or throwing.
    expect(() => Buffer.from(result, 'utf8').toString('utf8')).not.toThrow();
    expect(result).toMatch(/\[…truncated\]$/);
  });
});

// ── pruneTree ─────────────────────────────────────────────────────────────────

describe('pruneTree', () => {
  it('passes through clean paths unchanged', () => {
    const paths = ['src/index.ts', 'README.md', 'package.json'];
    expect(pruneTree(paths)).toEqual(paths);
  });

  it('removes node_modules paths', () => {
    const paths = ['src/index.ts', 'node_modules/react/index.js', 'README.md'];
    expect(pruneTree(paths)).toEqual(['src/index.ts', 'README.md']);
  });

  it('removes dist and build output paths', () => {
    const paths = ['dist/bundle.js', 'build/app.js', 'src/app.ts'];
    expect(pruneTree(paths)).toEqual(['src/app.ts']);
  });

  it('removes lockfiles', () => {
    const paths = [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'src/index.ts',
    ];
    expect(pruneTree(paths)).toEqual(['src/index.ts']);
  });

  it('removes minified and source-map files', () => {
    const paths = ['dist/app.min.js', 'dist/app.js.map', 'src/app.ts'];
    expect(pruneTree(paths)).toEqual(['src/app.ts']);
  });

  it('removes .next and coverage directories', () => {
    const paths = ['.next/server/pages/index.js', 'coverage/lcov.info', 'src/app.ts'];
    expect(pruneTree(paths)).toEqual(['src/app.ts']);
  });

  it(`caps output at TREE_MAX_PATHS (${TREE_MAX_PATHS})`, () => {
    const paths = Array.from({ length: TREE_MAX_PATHS + 50 }, (_, i) => `src/file${i}.ts`);
    const result = pruneTree(paths);
    expect(result.length).toBe(TREE_MAX_PATHS);
  });

  it('preserves order of kept paths', () => {
    const paths = ['z.ts', 'node_modules/x.js', 'a.ts'];
    expect(pruneTree(paths)).toEqual(['z.ts', 'a.ts']);
  });
});

// ── gatherEvidence ────────────────────────────────────────────────────────────

function makeRequest(
  readmeBody: unknown,
  treeBody: unknown,
  {
    readmeStatus = 200,
    treeStatus = 200,
  }: { readmeStatus?: number; treeStatus?: number } = {},
) {
  return vi.fn(async (path: string) => {
    if (path.endsWith('/readme')) {
      return new Response(JSON.stringify(readmeBody), { status: readmeStatus });
    }
    if (path.includes('/git/trees/')) {
      return new Response(JSON.stringify(treeBody), { status: treeStatus });
    }
    return new Response('{}', { status: 404 });
  });
}

const SAMPLE_README_BODY = {
  encoding: 'base64',
  content: Buffer.from('# My Project\n\nA cool project.').toString('base64'),
};

const SAMPLE_TREE_BODY = {
  truncated: false,
  tree: [
    { type: 'blob', path: 'src/index.ts' },
    { type: 'blob', path: 'README.md' },
    { type: 'tree', path: 'src' }, // trees (dirs) should not appear in paths
  ],
};

describe('gatherEvidence', () => {
  it('returns readable evidence when both README and tree succeed', async () => {
    const request = makeRequest(SAMPLE_README_BODY, SAMPLE_TREE_BODY);
    const results = await gatherEvidence([{ owner: 'acme', name: 'app' }], { request });

    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r.readable).toBe(true);
    expect(r.readmeText).toContain('# My Project');
    expect(r.paths).toEqual(['src/index.ts', 'README.md']);
    expect(r.readmeBytes).toBeGreaterThan(0);
    expect(r.fileCount).toBe(2);
  });

  it('marks a repo as not readable when both README and tree fail', async () => {
    const request = makeRequest({}, {}, { readmeStatus: 404, treeStatus: 404 });
    const results = await gatherEvidence([{ owner: 'acme', name: 'gone' }], { request });

    expect(results[0].readable).toBe(false);
    expect(results[0].readmeBytes).toBe(0);
    expect(results[0].fileCount).toBe(0);
  });

  it('is still readable when only the README is available', async () => {
    const request = makeRequest(SAMPLE_README_BODY, {}, { treeStatus: 404 });
    const results = await gatherEvidence([{ owner: 'acme', name: 'app' }], { request });

    expect(results[0].readable).toBe(true);
    expect(results[0].readmeText).toContain('# My Project');
    expect(results[0].paths).toBeUndefined();
    expect(results[0].fileCount).toBe(0);
  });

  it('is still readable when only the tree is available', async () => {
    const request = makeRequest({}, SAMPLE_TREE_BODY, { readmeStatus: 404 });
    const results = await gatherEvidence([{ owner: 'acme', name: 'app' }], { request });

    expect(results[0].readable).toBe(true);
    expect(results[0].readmeText).toBeUndefined();
    expect(results[0].paths).toEqual(['src/index.ts', 'README.md']);
  });

  it('gathers evidence for multiple repos independently', async () => {
    const request = makeRequest(SAMPLE_README_BODY, SAMPLE_TREE_BODY);
    const results = await gatherEvidence(
      [
        { owner: 'acme', name: 'app' },
        { owner: 'acme', name: 'api' },
      ],
      { request },
    );

    expect(results).toHaveLength(2);
    expect(results[0].readable).toBe(true);
    expect(results[1].readable).toBe(true);
  });

  it('prunes noisy paths out of the tree', async () => {
    const noisyTree = {
      truncated: false,
      tree: [
        { type: 'blob', path: 'src/index.ts' },
        { type: 'blob', path: 'node_modules/react/index.js' },
        { type: 'blob', path: 'dist/bundle.js' },
        { type: 'blob', path: 'package-lock.json' },
      ],
    };
    const request = makeRequest(SAMPLE_README_BODY, noisyTree);
    const results = await gatherEvidence([{ owner: 'acme', name: 'app' }], { request });

    expect(results[0].paths).toEqual(['src/index.ts']);
    expect(results[0].fileCount).toBe(1);
  });

  it('truncates a README that exceeds the byte budget', async () => {
    const longReadme = {
      encoding: 'base64',
      content: Buffer.from('a'.repeat(README_MAX_BYTES + 500)).toString('base64'),
    };
    const request = makeRequest(longReadme, SAMPLE_TREE_BODY);
    const results = await gatherEvidence([{ owner: 'acme', name: 'app' }], { request });

    expect(results[0].readmeText).toMatch(/\[…truncated\]$/);
    // readmeBytes is the size BEFORE truncation
    expect(results[0].readmeBytes).toBe(README_MAX_BYTES + 500);
  });
});

// ── buildEvidenceBlock ────────────────────────────────────────────────────────

describe('buildEvidenceBlock', () => {
  it('returns an empty string when no repos are readable', () => {
    const evidence = [
      { owner: 'acme', name: 'app', readable: false, readmeBytes: 0, fileCount: 0 },
    ];
    expect(buildEvidenceBlock(evidence)).toBe('');
  });

  it('returns an empty string for an empty evidence array', () => {
    expect(buildEvidenceBlock([])).toBe('');
  });

  it('includes the repo slug, README, and file tree for readable repos', () => {
    const evidence = [
      {
        owner: 'acme',
        name: 'app',
        readable: true,
        readmeText: '# Acme App',
        paths: ['src/index.ts', 'README.md'],
        readmeBytes: 100,
        fileCount: 2,
      },
    ];
    const block = buildEvidenceBlock(evidence);
    expect(block).toContain('acme/app');
    expect(block).toContain('# Acme App');
    expect(block).toContain('src/index.ts');
  });

  it('stays under the total evidence budget with three large repos', () => {
    // Construct three repos each with a full ~6 KB README and 300 paths.
    const bigReadme = 'a'.repeat(README_MAX_BYTES);
    const manyPaths = Array.from({ length: TREE_MAX_PATHS }, (_, i) => `src/file${i}.ts`);
    const evidence = [1, 2, 3].map((n) => ({
      owner: 'org',
      name: `repo${n}`,
      readable: true,
      readmeText: bigReadme,
      paths: manyPaths,
      readmeBytes: README_MAX_BYTES,
      fileCount: TREE_MAX_PATHS,
    }));

    const block = buildEvidenceBlock(evidence);
    const blockBytes = Buffer.byteLength(block, 'utf8');
    expect(blockBytes).toBeLessThanOrEqual(EVIDENCE_BUDGET_BYTES);
  });

  it('skips unreadable repos when mixing readable and unreadable', () => {
    const evidence = [
      { owner: 'acme', name: 'good', readable: true, readmeText: '# Good', paths: ['a.ts'], readmeBytes: 10, fileCount: 1 },
      { owner: 'acme', name: 'bad', readable: false, readmeBytes: 0, fileCount: 0 },
    ];
    const block = buildEvidenceBlock(evidence);
    expect(block).toContain('acme/good');
    expect(block).not.toContain('acme/bad');
  });
});
