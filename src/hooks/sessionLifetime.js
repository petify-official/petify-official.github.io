import { useEffect } from "react";

export const SESSION_MAX_AGE_MS = 10 * 60 * 60 * 1000;

const memoryStarts = new Map();

function storageKey(session) {
  return `petify-session-start:${session.user.id}`;
}

export function startSessionLifetime(session, signedIn = false) {
  if (!session?.user?.id) return Date.now();
  const key = storageKey(session);
  if (!signedIn) {
    try {
      const savedStart = Number(localStorage.getItem(key));
      if (Number.isFinite(savedStart) && savedStart > 0) {
        memoryStarts.set(key, savedStart);
        return savedStart;
      }
    } catch (error) {
      console.warn("The session start time could not be read from browser storage.", error);
    }
    const memoryStart = memoryStarts.get(key);
    if (memoryStart) return memoryStart;
  }

  const lastSignIn = Date.parse(session.user.last_sign_in_at ?? "");
  const startedAt = !signedIn && Number.isFinite(lastSignIn) && lastSignIn > 0
    ? lastSignIn
    : Date.now();
  memoryStarts.set(key, startedAt);
  try {
    localStorage.setItem(key, String(startedAt));
  } catch (error) {
    console.warn("The session start time could not be persisted in browser storage.", error);
  }
  return startedAt;
}

export function isSessionExpired(session, now = Date.now()) {
  return now - startSessionLifetime(session) >= SESSION_MAX_AGE_MS;
}

export function clearSessionLifetime(session) {
  if (!session?.user?.id) return;
  const key = storageKey(session);
  memoryStarts.delete(key);
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("The session start time could not be removed from browser storage.", error);
  }
}

export function useSessionLifetime(session, onExpire) {
  useEffect(() => {
    if (!session?.user?.id) return undefined;
    const expiresAt = startSessionLifetime(session) + SESSION_MAX_AGE_MS;
    let timer;

    function enforceExpiry() {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        onExpire(session);
      } else {
        timer = window.setTimeout(enforceExpiry, remaining);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") enforceExpiry();
    }

    enforceExpiry();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session, onExpire]);
}
