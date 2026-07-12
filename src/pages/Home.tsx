import { type FC } from 'react';
import { Link as RouterLink } from '@tanstack/react-router';
import { Users, GraduationCap, Rocket, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  {
    icon: Users,
    label: 'collaborate',
    title: 'Find collaborators',
    body: 'Post a project, list what you need, and pair up with other members of the group.',
  },
  {
    icon: GraduationCap,
    label: 'learn',
    title: 'Learn in the open',
    body: 'Trade techniques and best practices. Everything is shared, nothing is gatekept.',
  },
  {
    icon: Rocket,
    label: 'ship',
    title: 'Actually ship it',
    body: 'Turn the idea you keep talking about at meetup into something that runs.',
  },
];

const Home: FC = () => {
  return (
    <div className="mx-auto max-w-5xl">
      {/* Hero */}
      <section className="relative overflow-hidden py-16 text-center sm:py-24">
        {/* soft brand glow behind the headline */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-8 -z-10 h-64 w-[40rem] max-w-full -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
        />
        <p className="mb-5 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
          <span className="text-brand-amber">//</span> casual coding meetup
        </p>
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
          Build the thing, together.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-muted-foreground">
          CodeCollabProj is where the group shares projects, finds collaborators, and ships side
          projects that would otherwise stay ideas.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <RouterLink to="/projects">
              Browse projects
              <ArrowRight className="size-4" />
            </RouterLink>
          </Button>
          <Button asChild size="lg" variant="outline">
            <RouterLink to="/register">Join the group</RouterLink>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="grid gap-4 pb-16 sm:grid-cols-3">
        {features.map(({ icon: Icon, label, title, body }) => (
          <Card
            key={label}
            className="group transition-colors hover:border-primary/40 hover:shadow-sm"
          >
            <CardHeader>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-5" />
              </div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {label}
              </p>
              <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">{body}</CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
};

export default Home;
