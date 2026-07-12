import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_main/about')({ component: About });

function About() {
  return (
    <div className="mx-auto max-w-sm px-4">
      <div className="mt-8 text-center">
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-foreground">About Page</h1>
        <Button asChild>
          <Link to="/">Go to Home</Link>
        </Button>
      </div>
    </div>
  );
}
