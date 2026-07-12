/**
 * react-router-dom → @tanstack/react-router compatibility shim.
 *
 * The legacy client is lifted 1:1 into this app; rather than hand-edit every
 * component, `react-router-dom` is aliased to this module (see vite.config.ts +
 * tsconfig paths). It re-exports the small slice of the react-router API the app
 * actually uses (Link, useNavigate, useParams, useSearchParams, useLocation,
 * Navigate, Outlet), backed by TanStack Router primitives, preserving the
 * react-router CALL SHAPES (e.g. `navigate('/x')`, `navigate(-1)`).
 *
 * This is a migration bridge. As routes are deepened into server functions /
 * typed navigation, components can drop back to importing @tanstack/react-router
 * directly and this shim shrinks.
 */
import * as React from 'react';
import {
  Link as TsrLink,
  Navigate as TsrNavigate,
  Outlet,
  useNavigate as useTsrNavigate,
  useParams as useTsrParams,
  useLocation as useTsrLocation,
  useRouter,
} from '@tanstack/react-router';

export { Outlet };

/* eslint-disable @typescript-eslint/no-explicit-any */

// Link — accepts react-router props (string `to`, `replace`, plus anything MUI
// forwards via `component={RouterLink}`). TanStack Link renders an <a>.
export const Link = React.forwardRef<HTMLAnchorElement, any>(function Link(
  { to, replace, state, ...rest },
  ref,
) {
  return <TsrLink ref={ref} to={to as any} replace={replace} {...rest} />;
});

// NavLink — same as Link for our purposes (Header styles active state via CSS).
export const NavLink = Link;

// useNavigate — returns react-router's `(to, opts?)` navigate function, mapping
// string paths, numeric deltas (`navigate(-1)`), and object args onto TanStack.
export function useNavigate() {
  const navigate = useTsrNavigate();
  const router = useRouter();
  return React.useCallback(
    (to: any, opts?: { replace?: boolean; state?: any }) => {
      if (typeof to === 'number') {
        router.history.go(to);
        return;
      }
      if (typeof to === 'string') {
        return navigate({ to, replace: opts?.replace } as any);
      }
      return navigate(to);
    },
    [navigate, router],
  );
}

// useParams — react-router returns a plain params object.
export function useParams<T = Record<string, string>>(): T {
  return (useTsrParams as any)({ strict: false }) as T;
}

// useLocation — expose pathname/search/hash like react-router.
export function useLocation() {
  const loc = useTsrLocation();
  return {
    pathname: loc.pathname,
    search: loc.searchStr ?? '',
    hash: loc.hash ?? '',
    state: (loc as any).state,
  };
}

// useSearchParams — read-only tuple is enough for current usage; setter routes
// through navigate for completeness.
export function useSearchParams(): [URLSearchParams, (next: URLSearchParams) => void] {
  const loc = useTsrLocation();
  const navigate = useTsrNavigate();
  const params = React.useMemo(
    () => new URLSearchParams(loc.searchStr ?? ''),
    [loc.searchStr],
  );
  const setParams = React.useCallback(
    (next: URLSearchParams) => {
      navigate({ to: loc.pathname, search: Object.fromEntries(next) } as any);
    },
    [navigate, loc.pathname],
  );
  return [params, setParams];
}

// Navigate — declarative redirect.
export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  return <TsrNavigate to={to as any} replace={replace} />;
}
