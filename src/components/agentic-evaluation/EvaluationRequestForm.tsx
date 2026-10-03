import React from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { IdeationReadmeInput } from '../../types/agentic-evaluation/evaluation';

interface EvaluationRequestFormProps {
  projectId: string;
  onSubmit: (input: IdeationReadmeInput) => void;
  isPending: boolean;
  error?: string | null;
  /** Pre-fill the form from a previous evaluation's input (e.g. the most recent). */
  defaultValues?: Partial<IdeationReadmeInput>;
}

interface FormValues extends IdeationReadmeInput {}

const FIELDS: {
  name: keyof FormValues;
  label: string;
  placeholder: string;
  required: boolean;
}[] = [
  {
    name: 'problemStatement',
    label: 'Problem Statement & Intent',
    placeholder: 'What problem does this project solve and why does it matter?',
    required: true,
  },
  {
    name: 'targetAudience',
    label: 'Target Audience & Use Case',
    placeholder: 'Who will use this, and in what context?',
    required: true,
  },
  {
    name: 'coreFeatures',
    label: 'Core Features (MVP Definition)',
    placeholder: 'What are the must-have features for a first working version?',
    required: true,
  },
  {
    name: 'techApproach',
    label: 'Technical Approach',
    placeholder: 'Tech stack, framework, or architecture you have in mind (optional)',
    required: false,
  },
  {
    name: 'repositoryUrl',
    label: 'Repository URL',
    placeholder: 'https://github.com/your-username/your-repo (optional)',
    required: false,
  },
  {
    name: 'successMetrics',
    label: 'Success Metrics',
    placeholder: 'How will you know if this project succeeded?',
    required: true,
  },
  {
    name: 'timelineAndConstraints',
    label: 'Timeline & Constraints',
    placeholder: 'Expected timeline, team size, budget, or other constraints.',
    required: true,
  },
  {
    name: 'risksAndQuestions',
    label: 'Known Risks & Open Questions',
    placeholder: 'What could go wrong? What are you unsure about?',
    required: true,
  },
];

const EvaluationRequestForm: React.FC<EvaluationRequestFormProps> = ({
  onSubmit,
  isPending,
  error,
  defaultValues,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues });

  const onValid = (data: FormValues) => onSubmit(data);

  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span className="text-brand-amber">//</span> ideation evaluation
        </p>
        <h3 className="text-base font-semibold">Request an AI Evaluation</h3>
        <p className="text-sm text-muted-foreground">
          Fill in the README fields below. The AI will assess your project idea across clarity,
          scope, feasibility, and more — and give you a readiness score.
        </p>
        <p className="text-xs text-muted-foreground">
          {defaultValues
            ? 'Fields pre-filled from your last evaluation — edit and re-run to update.'
            : 'Up to 3 evaluations are kept per project. Running a new one removes the oldest.'}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onValid)} className="grid gap-5">
          {FIELDS.map(({ name, label, placeholder, required }) => (
            <div key={name} className="grid gap-1.5">
              <Label htmlFor={name}>
                {label}
                {required && <span className="ml-1 text-destructive">*</span>}
              </Label>
              <Textarea
                id={name}
                rows={3}
                placeholder={placeholder}
                {...register(name, required ? { required: `${label} is required` } : {})}
                className={errors[name] ? 'border-destructive' : ''}
              />
              {errors[name] && (
                <p className="text-xs text-destructive">{errors[name]?.message}</p>
              )}
            </div>
          ))}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Running evaluation…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Run Ideation Evaluation
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default EvaluationRequestForm;
