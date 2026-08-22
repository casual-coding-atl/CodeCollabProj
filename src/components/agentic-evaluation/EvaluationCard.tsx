import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Evaluation } from '../../types/agentic-evaluation/evaluation';

interface EvaluationCardProps {
  evaluation: Evaluation;
  isExpanded: boolean;
  onToggle: () => void;
}

const SCORE_COLOUR: Record<number, string> = {
  1: 'text-destructive',
  2: 'text-destructive',
  3: 'text-yellow-600 dark:text-yellow-400',
  4: 'text-green-600 dark:text-green-400',
  5: 'text-green-600 dark:text-green-400',
};

const EvaluationCard: React.FC<EvaluationCardProps> = ({
  evaluation,
  isExpanded,
  onToggle,
}) => {
  const score = evaluation.findings?.readinessScore;
  const date = new Date(evaluation.requestedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card className="transition-colors hover:bg-muted/40">
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-3">
          {score !== undefined ? (
            <span className={`font-mono text-lg font-bold ${SCORE_COLOUR[score] ?? ''}`}>
              {score}/5
            </span>
          ) : (
            <Badge variant="secondary">
              {evaluation.status === 'pending' ? 'Pending…' : 'Failed'}
            </Badge>
          )}
          <div>
            <p className="text-sm font-medium text-foreground">Ideation Evaluation</p>
            <p className="font-mono text-[11px] text-muted-foreground">{date}</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse evaluation' : 'Expand evaluation'}
        >
          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </CardContent>
    </Card>
  );
};

export default EvaluationCard;
