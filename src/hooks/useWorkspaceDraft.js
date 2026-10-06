import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteWorkspaceDraft,
  getWorkspaceDraft,
  saveWorkspaceDraft,
} from "../services/workspaceDrafts.js";

const alwaysSave = () => true;

export default function useWorkspaceDraft({
  userId,
  draftType,
  draftKey,
  value,
  onRestore,
  ready = true,
  enabled = true,
  shouldSave = alwaysSave,
}) {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [clearVersion, setClearVersion] = useState(0);
  const skipNextAutosave = useRef(true);
  const autosaveTimer = useRef(0);
  const pendingSave = useRef(Promise.resolve());
  const valueRef = useRef(value);
  valueRef.current = value;
  const serializedValue = JSON.stringify(value);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setLoadFailed(false);
    skipNextAutosave.current = true;
    if (!enabled || !userId || !draftKey || !ready) {
      setLoaded(true);
      return () => { active = false; };
    }
    getWorkspaceDraft(userId, draftType, draftKey)
      .then((draft) => {
        if (!active) return;
        if (draft) {
          onRestoreRef.current?.(draft.payload);
          setRestored(true);
        }
        setError("");
      })
      .catch((loadError) => {
        if (active) {
          setLoadFailed(true);
          setError(loadError.message || "The saved draft could not be loaded.");
        }
      })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [userId, draftType, draftKey, ready, enabled]);

  const saveNow = useCallback(async (nextValue = valueRef.current) => {
    if (!userId || !draftKey) return;
    setSaving(true);
    setError("");
    try {
      const saveOperation = saveWorkspaceDraft(userId, draftType, draftKey, nextValue);
      pendingSave.current = saveOperation;
      await saveOperation;
      setRestored(true);
      setLoadFailed(false);
      skipNextAutosave.current = false;
      setError("");
    } catch (saveError) {
      setError(saveError.message || "The draft could not be saved.");
      throw saveError;
    } finally {
      setSaving(false);
    }
  }, [userId, draftType, draftKey]);

  const clear = useCallback(async () => {
    if (!userId || !draftKey) return;
    window.clearTimeout(autosaveTimer.current);
    skipNextAutosave.current = true;
    setClearVersion((version) => version + 1);
    setError("");
    try {
      await pendingSave.current.catch(() => {});
      await deleteWorkspaceDraft(userId, draftType, draftKey);
      setRestored(false);
      setLoadFailed(false);
    } catch (clearError) {
      setError(clearError.message || "The draft could not be discarded.");
      throw clearError;
    }
  }, [userId, draftType, draftKey]);

  useEffect(() => {
    if (!enabled || !loaded || !ready || !userId || !draftKey || loadFailed || !shouldSave(valueRef.current)) return undefined;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return undefined;
    }
    const snapshot = serializedValue;
    autosaveTimer.current = window.setTimeout(() => {
      setSaving(true);
      const operation = saveWorkspaceDraft(userId, draftType, draftKey, JSON.parse(snapshot))
        .then(() => { setError(""); setRestored(true); })
        .catch((saveError) => setError(saveError.message || "The draft could not be autosaved."))
        .finally(() => setSaving(false));
      pendingSave.current = operation;
    }, 900);
    return () => window.clearTimeout(autosaveTimer.current);
  }, [serializedValue, enabled, loaded, ready, userId, draftType, draftKey, loadFailed, shouldSave, clearVersion]);

  return { loaded, saving, error, restored, saveNow, clear };
}
