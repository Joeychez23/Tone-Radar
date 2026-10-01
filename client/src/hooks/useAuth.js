import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, setUnauthorizedHandler } from "../lib/api";
import { load, save } from "../lib/storage";
import { DEFAULT_SENSITIVITY } from "../lib/heat";

const AuthContext = createContext(null);

const GUEST_SETTINGS = { audience: "peer", channel: "email", sensitivity: DEFAULT_SENSITIVITY };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | guest | signedIn
  const [accountsAvailable, setAccountsAvailable] = useState(false);
  const [guestSettings, setGuestSettings] = useState(() => ({ ...GUEST_SETTINGS, ...load("guestSettings", {}) }));
  const pendingSettings = useRef(null);
  const settingsTimer = useRef(null);

  const signOut = useCallback(() => {
    save("token", null);
    setUser(null);
    setStatus("guest");
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    let cancelled = false;
    let retryTimer;
    const check = async (attempt = 0) => {
      const health = await api("/health").catch(() => null);
      if (cancelled) return;
      // The database may still be connecting right after the server starts.
      if (health?.db === "connecting" && attempt < 8) {
        retryTimer = setTimeout(() => check(attempt + 1), 1500);
        return;
      }
      setAccountsAvailable(Boolean(health?.accounts));
      if (!load("token", null) || !health?.accounts) return setStatus("guest");
      try {
        const { user } = await api("/auth/me");
        if (!cancelled) {
          setUser(user);
          setStatus("signedIn");
        }
      } catch {
        if (!cancelled) signOut();
      }
    };
    check();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [signOut]);

  const finish = useCallback(({ token, user }) => {
    save("token", token);
    setUser(user);
    setStatus("signedIn");
    return user;
  }, []);

  const signIn = useCallback((email, password) => api("/auth/login", { method: "POST", body: { email, password } }).then(finish), [finish]);
  const register = useCallback(
    (email, password, name) => api("/auth/register", { method: "POST", body: { email, password, name } }).then(finish),
    [finish]
  );

  const deleteAccount = useCallback(async () => {
    await api("/auth/account", { method: "DELETE" });
    signOut();
  }, [signOut]);

  // Settings update locally at once; signed-in users sync to the server,
  // debounced so dragging a slider doesn't send a request per pixel.
  const updateSettings = useCallback(
    (patch) => {
      if (status !== "signedIn") {
        setGuestSettings((prev) => {
          const next = { ...prev, ...patch, sensitivity: { ...prev.sensitivity, ...(patch.sensitivity || {}) } };
          save("guestSettings", next);
          return next;
        });
        return;
      }
      setUser((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...patch, sensitivity: { ...prev.settings.sensitivity, ...(patch.sensitivity || {}) } },
      }));
      pendingSettings.current = {
        ...(pendingSettings.current || {}),
        ...patch,
        sensitivity: { ...(pendingSettings.current?.sensitivity || {}), ...(patch.sensitivity || {}) },
      };
      clearTimeout(settingsTimer.current);
      settingsTimer.current = setTimeout(() => {
        const body = pendingSettings.current;
        pendingSettings.current = null;
        api("/auth/settings", { method: "PATCH", body }).catch(() => {});
      }, 600);
    },
    [status]
  );

  const settings = status === "signedIn" && user ? user.settings : guestSettings;

  const value = useMemo(
    () => ({ user, status, accountsAvailable, settings, signIn, register, signOut, updateSettings, deleteAccount }),
    [user, status, accountsAvailable, settings, signIn, register, signOut, updateSettings, deleteAccount]
  );
  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
