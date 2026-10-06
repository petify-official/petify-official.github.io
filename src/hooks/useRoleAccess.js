import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

function readCachedRoles(userId) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(`petify-roles:${userId}`) ?? "null");
    if (cached && typeof cached === "object" && Number.isFinite(cached.checkedAt)) return cached;
  } catch (error) {
    console.warn("Cached workspace access could not be read.", error);
  }
  return null;
}

function writeCachedRoles(userId, roles) {
  try {
    sessionStorage.setItem(`petify-roles:${userId}`, JSON.stringify({ ...roles, checkedAt: Date.now() }));
  } catch (error) {
    console.warn("Workspace access could not be cached for this session.", error);
  }
}

export default function useRoleAccess(session, roleTable) {
  const userId = session?.user?.id ?? "";
  const roleQueryKey = roleTable.map((role) => `${role.name}:${role.table}`).join("|");
  const [roleState, setRoleState] = useState(() => ({
    userId,
    roles: userId ? readCachedRoles(userId) ?? {} : {},
  }));
  const hasCurrentRoles = roleState.userId === userId;
  const roles = hasCurrentRoles ? roleState.roles : {};
  const [loading, setLoading] = useState(() => Boolean(userId && !readCachedRoles(userId)));
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!userId || !supabase) {
      setRoleState({ userId, roles: {} });
      setLoading(false);
      setError("");
      return undefined;
    }

    const initialCache = readCachedRoles(userId);
    if (initialCache) {
      setRoleState({ userId, roles: initialCache });
      setLoading(false);
    } else {
      setLoading(true);
    }

    async function checkRoles() {
      try {
        const results = await Promise.all(roleQueryKey.split("|").map(async (entry) => {
          const [name, table] = entry.split(":");
          const { data, error: roleError } = await supabase
            .from(table)
            .select("user_id")
            .eq("user_id", userId)
            .maybeSingle();
          if (roleError) throw roleError;
          return [name, Boolean(data)];
        }));
        if (!active) return;
        const nextRoles = Object.fromEntries(results);
        setRoleState({ userId, roles: nextRoles });
        writeCachedRoles(userId, nextRoles);
        setError("");
      } catch (roleError) {
        if (active) setError(initialCache ? "" : roleError.message || "Workspace access could not be verified.");
      } finally {
        if (active) setLoading(false);
      }
    }

    checkRoles();
    return () => { active = false; };
  }, [userId, roleQueryKey]);

  return { roles, loading: loading || Boolean(userId && !hasCurrentRoles), error };
}
