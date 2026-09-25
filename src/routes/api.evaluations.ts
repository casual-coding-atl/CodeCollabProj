import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Evaluation, Project, MAX_EVALUATIONS_PER_TYPE } from '../server/models';
import { claudeRequest, claudeApiKey } from '../server/claude';
import { reposOf, resolveGitHubToken } from '../server/github';
import { gatherEvidence, buildEvidenceBlock } from '../services/agentic-evaluation/evidence';
import type { IdeationReadmeInput, IdeationEvaluationFindings } from '../types/agentic-evaluation/evaluation';

/**
 * /api/evaluations
 *   POST → create a new ideation evaluation for a project (owner only)
 *
 * Rolling-cap rule: at most MAX_EVALUATIONS_PER_TYPE (3) evaluations of the
 * same agentType are kept per project. When the cap is reached the oldest is
 * deleted before the new document is inserted.
 *
 * 409 is returned if an evaluation is already pending (prevents double-submit
 * and runaway Claude spend).
 *
 * 503 is returned if ANTHROPIC_API_KEY is not configured.
 */
export const Route = createFileRoute('/api/evaluations')({
  server: {
    handlers: {
      POST: handler(async ({ request }) => {
        const user = await requireUser(request);
        await connectDB();

        if (!claudeApiKey()) {
          return error(503, 'AI evaluation is not configured on this server');
        }

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
        const input = body.input as IdeationReadmeInput | undefined;

        // ── Validate input ────────────────────────────────────────────────────
        if (!projectId) return error(400, 'projectId is required');
        if (!input) return error(400, 'input is required');

        const requiredFields: (keyof IdeationReadmeInput)[] = [
          'problemStatement',
          'targetAudience',
          'coreFeatures',
          'successMetrics',
          'timelineAndConstraints',
          'risksAndQuestions',
        ];
        for (const field of requiredFields) {
          const val = typeof input[field] === 'string' ? (input[field] as string).trim() : '';
          if (!val) return error(400, `input.${field} is required`);
        }

        // ── Ownership check ───────────────────────────────────────────────────
        const project = await Project.findById(projectId).lean().exec();
        if (!project) return error(404, 'Project not found');
        if (String(project.owner) !== String(user._id)) {
          return error(403, 'Only the project owner can request an evaluation');
        }

        // ── Block concurrent pending ──────────────────────────────────────────
        const alreadyPending = await Evaluation.exists({
          projectId: project._id,
          agentType: 'ideation',
          status: 'pending',
        });
        if (alreadyPending) {
          return error(409, 'An evaluation is already in progress for this project');
        }

        // ── Rolling cap: trim oldest if at limit ──────────────────────────────
        const existingCount = await Evaluation.countDocuments({
          projectId: project._id,
          agentType: 'ideation',
        });
        if (existingCount >= MAX_EVALUATIONS_PER_TYPE) {
          const oldest = await Evaluation.findOne({
            projectId: project._id,
            agentType: 'ideation',
          })
            .sort({ requestedAt: 1 })
            .exec();
          if (oldest) await oldest.deleteOne();
        }

        // ── Gather evidence from linked repositories ──────────────────────────
        const linkedRepos = reposOf(project);
        const token = await resolveGitHubToken(user._id.toString()).catch(() => undefined);
        const evidence = linkedRepos.length > 0
          ? await gatherEvidence(linkedRepos, { token })
          : [];
        const evidenceBlock = buildEvidenceBlock(evidence);
        const hasEvidence = evidenceBlock.length > 0;

        // ── Create the pending document ───────────────────────────────────────
        const evalDoc = await Evaluation.create({
          projectId: project._id,
          userId: user._id,
          agentType: 'ideation',
          status: 'pending',
          input,
          // Store only summary metadata, not the README/tree contents.
          evidence: evidence.length > 0 ? evidence.map(({ owner, name, readable, readmeBytes, fileCount }) => ({
            owner, name, readable, readmeBytes, fileCount,
          })) : undefined,
          requestedAt: new Date(),
        });

        // ── Build and send prompt to Claude ───────────────────────────────────
        const realityCheckInstruction = hasEvidence
          ? `
7. **Reality Check** — Compare the submitted README (the pitch) against the repository evidence (what actually exists). Call out confirmations where the code matches the claims, and gaps where it does not. Reference specific repository names where relevant. This finding is only included when repository evidence is available.`
          : '';

        const realityCheckSchemaNote = hasEvidence
          ? ' When repository evidence is provided, include a seventh finding with dimension "Reality Check".'
          : '';

        const systemPrompt = `You are an experienced product and startup advisor evaluating early-stage software project ideas. Your job is to give honest, constructive, encouraging feedback — not praise everything, but also not be harsh. You are reviewing a project README submitted by a developer at the ideation stage.

Evaluate the README across these six dimensions:
1. Clarity of Intent — Is the problem and goal clearly articulated?
2. Scope & Prioritisation Realism — Is the MVP scope sensible and achievable?
3. User Need Validation — Is there evidence the target audience actually has this problem?
4. Feasibility Assessment — Is the technical approach and timeline realistic?
5. Completeness of Vision — Are the success metrics, risks, and constraints well-considered?
6. Differentiation — Does this have a clear angle or advantage over existing solutions?${realityCheckInstruction}

Return ONLY valid JSON matching this exact schema with no prose, no markdown fences, and no commentary outside the JSON:
{"summary":"string","findings":[{"dimension":"string","assessment":"string","suggestion":"string (optional)"}],"actionItems":["string (3-5 items)"],"readinessScore":1}${realityCheckSchemaNote}

readinessScore must be an integer 1-5: 1=very early/unclear, 2=some foundation but significant gaps, 3=decent foundation/several things to clarify, 4=well-defined/minor things to sharpen, 5=clear/well-scoped/ready to build.
The readinessScore and the six original dimensions are based solely on the submitted README — do not let the repository evidence change the score.`;

        const evidenceSection = hasEvidence
          ? `\n\n${evidenceBlock}`
          : '';

        const userMessage = `Please evaluate the following project idea.

Problem Statement & Intent:
${input.problemStatement}

Target Audience & Use Case:
${input.targetAudience}

Core Features (MVP Definition):
${input.coreFeatures}

Technical Approach:
${input.techApproach || 'Not specified'}

Repository URL:
${input.repositoryUrl || 'Not provided'}

Success Metrics:
${input.successMetrics}

Timeline & Constraints:
${input.timelineAndConstraints}

Known Risks & Open Questions:
${input.risksAndQuestions}${evidenceSection}

Return only the JSON evaluation object.`;

        const result = await claudeRequest({
          systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
          maxTokens: 3072,
        });

        if (!result.ok) {
          await Evaluation.findByIdAndUpdate(evalDoc._id, { status: 'failed' });
          return error(502, `Evaluation failed: ${result.reason}`);
        }

        // ── Parse Claude's JSON response ──────────────────────────────────────
        let findings: IdeationEvaluationFindings;
        try {
          // Strip accidental markdown fences if Claude included them
          const cleaned = result.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
          findings = JSON.parse(cleaned) as IdeationEvaluationFindings;
        } catch {
          await Evaluation.findByIdAndUpdate(evalDoc._id, { status: 'failed' });
          return error(502, 'Evaluation response could not be parsed');
        }

        // Clamp readinessScore to 1–5 defensively
        const score = Number(findings.readinessScore);
        findings.readinessScore = (Math.min(5, Math.max(1, isNaN(score) ? 3 : score))) as 1 | 2 | 3 | 4 | 5;

        const completed = await Evaluation.findByIdAndUpdate(
          evalDoc._id,
          { status: 'completed', findings, completedAt: new Date() },
          { new: true },
        ).exec();
        // Evidence metadata was already stored on creation; no update needed.

        return json({ message: 'Evaluation completed', evaluation: completed }, 201);
      }),
    },
  },
});
