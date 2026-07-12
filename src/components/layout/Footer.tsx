import { type FC } from 'react';

const Footer: FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center sm:px-6">
        <div className="flex items-center gap-2.5">
          <img
            src="/CC-Logo-ColorBg.png"
            alt="Casual Coding Meetup Group logo"
            className="h-8 w-auto rounded-md"
          />
          <span className="flex flex-col items-start leading-none">
            <span className="text-sm font-semibold tracking-tight">CodeCollabProj</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              casual coding meetup
            </span>
          </span>
        </div>
        <p className="max-w-md text-xs text-muted-foreground">
          Build together. Share projects, find collaborators, and ship with the group.
        </p>
        <p className="font-mono text-[11px] text-muted-foreground/70">
          © {year} Casual Coding Meetup Group
        </p>
      </div>
    </footer>
  );
};

export default Footer;
