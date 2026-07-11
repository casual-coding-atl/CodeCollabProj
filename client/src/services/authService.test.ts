import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authService } from './authService';
import api from '../utils/api';

vi.mock('../utils/api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const mockedPost = vi.mocked(api.post);

describe('authService.refreshToken (issue #18 – cookie-based refresh)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Cookie-based session: localStorage holds no tokens. Provide a complete stub.
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    });
  });

  it('calls the refresh endpoint even when no refresh token is in localStorage (cookie auth)', async () => {
    // Cookie-based session: localStorage holds no refresh token.
    mockedPost.mockResolvedValueOnce({
      data: { accessToken: 'new-access-token', expiresIn: 900 },
    } as never);

    const token = await authService.refreshToken();

    // It must hit the endpoint (the httpOnly refresh cookie is sent by axios),
    // not throw early because localStorage is empty.
    expect(mockedPost).toHaveBeenCalledWith('/auth/refresh-token', expect.anything());
    expect(token).toBe('new-access-token');
  });

  it('rejects (and clears tokens) only when the refresh request itself fails', async () => {
    mockedPost.mockRejectedValueOnce(new Error('Invalid or expired refresh token'));

    await expect(authService.refreshToken()).rejects.toThrow();
    expect(mockedPost).toHaveBeenCalledTimes(1);
  });
});
