import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { createApiClient, type ApiClient, ApiError } from "@/shared/api";
import { useRuntimeConfig } from "@/shared/config";

import {
  fetchCurrentActor,
  loginWithPassword,
  logoutSession,
  refreshCurrentSession,
} from "./api";
import { getSessionRefreshDelayMs } from "./refresh";
import type { AuthenticatedActor, AuthState, ForbiddenDetails } from "./types";

interface AuthContextValue extends AuthState {
  apiClient: ApiClient;
  bootstrap(): Promise<void>;
  login(password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const DEVELOPMENT_ACTOR_ID = "local_dev";
const REFRESH_RETRY_DELAY_MS = 5_000;

function clearRefreshState(
  timerRef: { current: null | number },
  nextRefreshAtMsRef: { current: null | number },
) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  nextRefreshAtMsRef.current = null;
}

function scheduleRefreshTimer(
  timerRef: { current: null | number },
  nextRefreshAtMsRef: { current: null | number },
  expiresAt: number,
  refresh: () => Promise<void>,
) {
  const delayMs = getSessionRefreshDelayMs(expiresAt);
  clearRefreshState(timerRef, nextRefreshAtMsRef);
  nextRefreshAtMsRef.current = Date.now() + delayMs;
  timerRef.current = window.setTimeout(() => {
    nextRefreshAtMsRef.current = null;
    void refresh();
  }, delayMs);
}

function scheduleRefreshRetry(
  timerRef: { current: null | number },
  nextRefreshAtMsRef: { current: null | number },
  refresh: () => Promise<void>,
) {
  clearRefreshState(timerRef, nextRefreshAtMsRef);
  nextRefreshAtMsRef.current = Date.now() + REFRESH_RETRY_DELAY_MS;
  timerRef.current = window.setTimeout(() => {
    nextRefreshAtMsRef.current = null;
    void refresh();
  }, REFRESH_RETRY_DELAY_MS);
}

function isDevelopmentActor(actor: AuthenticatedActor | null): boolean {
  return actor?.actor_id === DEVELOPMENT_ACTOR_ID;
}

function createUnauthenticatedState(isAuthDisabled: boolean): AuthState {
  return {
    actor: null,
    capabilities: new Set<string>(),
    csrfToken: null,
    forbidden: null,
    isAuthDisabled,
    lastForbiddenMessage: null,
    status: "unauthenticated",
  };
}

function createAuthenticatedState(
  actor: AuthenticatedActor,
  isAuthDisabled: boolean,
): AuthState {
  return {
    actor,
    capabilities: new Set(actor.capabilities),
    csrfToken: actor.csrf_token,
    forbidden: null,
    isAuthDisabled: isAuthDisabled && isDevelopmentActor(actor),
    lastForbiddenMessage: null,
    status: "authenticated",
  };
}

function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

function toForbiddenDetails(error: ApiError, fallbackMessage?: string): ForbiddenDetails {
  return {
    message: fallbackMessage ?? error.msg ?? "当前账号没有执行该操作的权限。",
    requestId: error.requestId ?? null,
    traceId: error.traceId ?? null,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const config = useRuntimeConfig();
  const [state, setState] = useState<AuthState>(() => ({
    ...createUnauthenticatedState(false),
    status: "bootstrapping",
  }));
  const csrfTokenRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<null | number>(null);
  const nextRefreshAtMsRef = useRef<null | number>(null);
  const lastRefreshAttemptAtMsRef = useRef(0);

  const handleUnauthorized = useCallback(() => {
    clearRefreshState(refreshTimerRef, nextRefreshAtMsRef);
    csrfTokenRef.current = null;
    setState(createUnauthenticatedState(!config.authEnabled));
  }, [config.authEnabled]);

  const apiClient = useMemo(
    () =>
      createApiClient({
        baseURL: config.apiBaseUrl || undefined,
        getCsrfToken: () => csrfTokenRef.current,
        onError: (error) => {
          if (isForbidden(error)) {
            setState((current) => ({
              ...current,
              forbidden: toForbiddenDetails(error),
              lastForbiddenMessage: error.msg,
            }));
          }
        },
        onUnauthorized: handleUnauthorized,
        withCredentials: true,
      }),
    [config.apiBaseUrl, handleUnauthorized],
  );

  const setAuthenticatedActor = useCallback(
    (actor: AuthenticatedActor) => {
      csrfTokenRef.current = actor.csrf_token;
      setState(createAuthenticatedState(actor, !config.authEnabled));
    },
    [config.authEnabled],
  );

  const refreshAuthenticatedSession = useCallback(async () => {
    if (!config.authEnabled || !csrfTokenRef.current) {
      clearRefreshState(refreshTimerRef, nextRefreshAtMsRef);
      return;
    }

    const nowMs = Date.now();
    if (nowMs - lastRefreshAttemptAtMsRef.current < REFRESH_RETRY_DELAY_MS) {
      return;
    }

    lastRefreshAttemptAtMsRef.current = nowMs;

    try {
      const refreshedSession = await refreshCurrentSession(apiClient);

      setAuthenticatedActor(refreshedSession);
      scheduleRefreshTimer(
        refreshTimerRef,
        nextRefreshAtMsRef,
        refreshedSession.expires_at,
        refreshAuthenticatedSession,
      );
    } catch (error) {
      if (!(error instanceof ApiError)) {
        throw error;
      }
      if (error.status === 401) {
        handleUnauthorized();
        return;
      }

      if (error.status === 403) {
        try {
          const actor = await fetchCurrentActor(apiClient);
          setState((current) => ({
            ...current,
            forbidden: null,
            lastForbiddenMessage: null,
          }));
          setAuthenticatedActor(actor);
          scheduleRefreshRetry(
            refreshTimerRef,
            nextRefreshAtMsRef,
            refreshAuthenticatedSession,
          );
          return;
        } catch (bootstrapError) {
          if (!(bootstrapError instanceof ApiError)) {
            throw bootstrapError;
          }

          if (bootstrapError.status !== 401) {
            throw bootstrapError;
          }

          handleUnauthorized();
        }

        return;
      }

      scheduleRefreshRetry(
        refreshTimerRef,
        nextRefreshAtMsRef,
        refreshAuthenticatedSession,
      );
    }
  }, [apiClient, config.authEnabled, handleUnauthorized, setAuthenticatedActor]);

  const bootstrap = useCallback(async () => {
    setState((current) => ({ ...current, status: "bootstrapping" }));

    try {
      const actor = await fetchCurrentActor(apiClient);
      setAuthenticatedActor(actor);
      // `/me` only returns the actor snapshot, so we prime `/auth/refresh` once to learn
      // the current idle expiration and start client-side refresh scheduling.
      await refreshAuthenticatedSession();
    } catch (error) {
      if (isForbidden(error)) {
        const forbiddenError = error as ApiError
        setState((current) => ({
          ...current,
          forbidden: toForbiddenDetails(forbiddenError),
          lastForbiddenMessage: forbiddenError.msg,
          status: "authenticated",
        }));
        return
      }

      handleUnauthorized();
    }
  }, [apiClient, handleUnauthorized, refreshAuthenticatedSession, setAuthenticatedActor]);

  const login = useCallback(
    async (password: string) => {
      const actor = await loginWithPassword(apiClient, { password });
      setAuthenticatedActor(actor);
      // Login response does not include exp/max_exp, so the explicit refresh endpoint
      // seeds the first client-side refresh timer.
      await refreshAuthenticatedSession();
    },
    [apiClient, refreshAuthenticatedSession, setAuthenticatedActor],
  );

  const logout = useCallback(async () => {
    if (state.status !== "authenticated") {
      handleUnauthorized();
      return;
    }

    try {
      await logoutSession(apiClient);
    } finally {
      handleUnauthorized();
    }
  }, [apiClient, handleUnauthorized, state.status]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => () => clearRefreshState(refreshTimerRef, nextRefreshAtMsRef), []);

  useEffect(() => {
    if (!config.authEnabled || state.status !== "authenticated") {
      return;
    }

    const handleWindowFocus = () => {
      if (nextRefreshAtMsRef.current !== null && Date.now() < nextRefreshAtMsRef.current) {
        return;
      }

      void refreshAuthenticatedSession();
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [config.authEnabled, refreshAuthenticatedSession, state.status]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      apiClient,
      bootstrap,
      login,
      logout,
    }),
    [apiClient, bootstrap, login, logout, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return value;
}
