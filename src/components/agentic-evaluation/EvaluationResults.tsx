import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Evaluation, EvaluationFinding } from '../../types/agentic-evaluation/evaluation';

interface EvaluationResultsProps {
  evaluation: Evaluation;
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Very Early',
  2: 'Some Foundation',
  3: 'Decent Foundation',
  4: 'Well Defined',
  5: 'Ready to Build',
};

const SCORE_VARIANT: Record<number, 'destructive' | 'secondary' | 'default' | 'outline'> = {
  1: 'destructive',
  2: 'destructive',
  3: 'secondary',
  4: 'default',
  5: 'default',
};

const ReadinessScore: React.FC<{ score: number }> = ({ score }) => (
  <div className="flex items-center gap-3">
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={`h-2.5 w-8 rounded-sm ${
            n <= score ? 'bg-primary' : 'bg-muted'
          }`}
        />
      ))}
    </div>
    <Badge variant={SCORE_VARIANT[score] ?? 'outline'}>
      {score}/5 — {SCORE_LABELS[score] ?? 'Scored'}
    </Badge>
  </div>
);

const REALITY_CHECK_DIMENSION = 'Reality Check';

/**
 * Render inline **bold** markers within a text segment.
 * e.g. "**30-day horizon**" → <strong>30-day horizon</strong>
 */
const InlineBold: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i} className="font-semibold text-foreground">{part}</strong> : part
      )}
    </>
  );
};

/**
 * Structured renderer for the Reality Check assessment text.
 * Claude returns it as a single string with:
 *   - An optional intro sentence before the first " - "
 *   - Bullet items separated by " - "
 *   - A "Conclusion: …" sentence at the end
 */
const RealityCheckAssessment: React.FC<{ text: string }> = ({ text }) => {
  // Split on " - " that starts a new point (not inside a word like "e.g. - ")
  const rawParts = text.split(/ - (?=[A-Z*'])/);

  // First segment is the intro paragraph if it doesn't look like a bullet
  const hasIntro = rawParts.length > 1 && !rawParts[0].startsWith("'");
  const intro = hasIntro ? rawParts[0] : null;
  const bullets = hasIntro ? rawParts.slice(1) : rawParts;

  // Separate out a trailing "Conclusion:" sentence if present
  const lastBullet = bullets[bullets.length - 1] ?? '';
  const conclusionMatch = lastBullet.match(/^(.*?)\s*Conclusion:\s*(.+)$/s);
  const bulletList = conclusionMatch
    ? [...bullets.slice(0, -1), conclusionMatch[1]].filter(Boolean)
    : bullets;
  const conclusion = conclusionMatch ? conclusionMatch[2] : null;

  return (
    <div className="grid gap-3">
      {intro && (
        <p className="text-sm text-muted-foreground">
          <InlineBold text={intro} />
        </p>
      )}
      {bulletList.length > 0 && (
        <ul className="grid gap-2">
          {bulletList.filter(Boolean).map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand-amber" />
              <span><InlineBold text={item.trim()} /></span>
            </li>
          ))}
        </ul>
      )}
      {conclusion && (
        <p className="text-sm font-medium text-foreground border-t border-border pt-2">
          <InlineBold text={conclusion} />
        </p>
      )}
    </div>
  );
};

const FindingRow: React.FC<{ finding: EvaluationFinding }> = ({ finding }) => {
  const isRealityCheck = finding.dimension === REALITY_CHECK_DIMENSION;
  return (
    <div
      className={`grid gap-2${isRealityCheck ? ' rounded-md border border-border bg-muted/40 p-4' : ' gap-1'}`}
      data-testid={isRealityCheck ? 'reality-check-finding' : undefined}
    >
      <p className="text-sm font-semibold text-foreground">
        {isRealityCheck && (
          <span className="mr-1.5 font-mono text-[10px] uppercase tracking-widest text-brand-amber">
            //
          </span>
        )}
        {finding.dimension}
      </p>
      {isRealityCheck
        ? <RealityCheckAssessment text={finding.assessment} />
        : <p className="text-sm text-muted-foreground">{finding.assessment}</p>
      }
      {finding.suggestion && (
        <p className="text-sm text-primary">
          <span className="font-medium">Suggestion: </span>
          {finding.suggestion}
        </p>
      )}
    </div>
  );
};

const EvaluationResults: React.FC<EvaluationResultsProps> = ({ evaluation }) => {
  const { findings } = evaluation;

  if (!findings) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">No findings available for this evaluation.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span className="text-brand-amber">//</span> evaluation results
        </p>
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold">Ideation Evaluation</h3>
          <span className="font-mono text-[11px] text-muted-foreground">
            {new Date(evaluation.requestedAt).toLocaleDateString()}
          </span>
        </div>
        <ReadinessScore score={findings.readinessScore} />
      </CardHeader>
      <CardContent className="grid gap-5">
        {/* Summary */}
        <p className="text-sm leading-relaxed text-foreground">{findings.summary}</p>

        <Separator />

        {/* Per-dimension findings — Reality Check (if present) is always last */}
        <div className="grid gap-4">
          <h4 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Findings
          </h4>
          {[
            ...findings.findings.filter((f) => f.dimension !== REALITY_CHECK_DIMENSION),
            ...findings.findings.filter((f) => f.dimension === REALITY_CHECK_DIMENSION),
          ].map((f, i, arr) => (
            <React.Fragment key={f.dimension}>
              <FindingRow finding={f} />
              {i < arr.length - 1 && <Separator />}
            </React.Fragment>
          ))}
        </div>

        {/* Action items */}
        {findings.actionItems.length > 0 && (
          <>
            <Separator />
            <div className="grid gap-2">
              <h4 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Next Steps
              </h4>
              <ul className="grid gap-1.5">
                {findings.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-0.5 font-mono text-[11px] text-brand-amber">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EvaluationResults;
