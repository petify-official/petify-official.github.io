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
  const identity = `${userId ?? ""}:${draftType}:${draftKey ?? ""}`;
  const [loadState, setLoadState] = useState({ identity: "", loaded: false, failed: false });
  const [saveState, setSaveState] = useState({ identity: "", saving: false });
  const [error, setError] = useState("");
  const [restoreState, setRestoreState] = useState({ identity: "", restored: false });
  const [clearVersion, setClearVersion] = useState(0);
  const skipNextAutosave = useRef(true);
  const autosaveTimer = useRef(0);
  const pendingSave = useRef(Promise.resolve());
  const saveQueue = useRef(Promise.resolve());
  const latestRevision = useRef(0);
  const valueRef = useRef(value);
  const serializedValue = JSON.stringify(value);
  const onRestoreRef = useRef(onRestore);
  const shouldLoad = enabled && Boolean(userId && draftKey && ready);
  const loaded = !shouldLoad || (loadState.identity === identity && loadState.loaded);
  const loadFailed = loadState.identity === identity && loadState.failed;
  const saving = saveState.identity === identity && saveState.saving;
  const restored = restoreState.identity === identity && restoreState.restored;

  useEffect(() => {
    valueRef.current = value;
    onRestoreRef.current = onRestore;
  }, [value, onRestore]);

  useEffect(() => {
    let active = true;
    skipNextAutosave.current = true;
    if (!shouldLoad) return () => { active = false; };
    getWorkspaceDraft(userId, draftType, draftKey)
      .then((draft) => {
        if (!active) return;
        if (draft) {
          onRestoreRef.current?.(draft.payload);
          setRestoreState({ identity, restored: true });
        }
        setLoadState({ identity, loaded: true, failed: false });
        setError("");
      })
      .catch((loadError) => {
        if (active) {
          setLoadState({ identity, loaded: true, failed: true });
          setError(loadError.message || "The saved draft could not be loaded.");
        }
      });
    return () => { active = false; };
  }, [identity, userId, draftType, draftKey, ready, enabled, shouldLoad]);

  const enqueueSave = useCallback((payload, revision) => {
    const operation = saveQueue.current
      .catch(() => {})
      .then(() => revision === latestRevision.current
        ? saveWorkspaceDraft(userId, draftType, draftKey, payload)
        : undefined);
    saveQueue.current = operation;
    pendingSave.current = operation;
    return operation;
  }, [userId, draftType, draftKey]);

  const saveNow = useCallback(async (nextValue = valueRef.current) => {
    if (!userId || !draftKey) return;
    window.clearTimeout(autosaveTimer.current);
    const revision = ++latestRevision.current;
    setSaveState({ identity, saving: true });
    setError("");
    try {
      await enqueueSave(nextValue, revision);
      if (revision === latestRevision.current) {
        setRestoreState({ identity, restored: true });
        setLoadState((current) => current.identity === identity
          ? { ...current, failed: false }
          : current);
      }
      skipNextAutosave.current = false;
      setError("");
    } catch (saveError) {
      setError(saveError.message || "The draft could not be saved.");
      throw saveError;
    } finally {
      if (revision === latestRevision.current) setSaveState({ identity, saving: false });
    }
  }, [enqueueSave, identity, userId, draftKey]);

  const clear = useCallback(async () => {
    if (!userId || !draftKey) return;
    window.clearTimeout(autosaveTimer.current);
    latestRevision.current += 1;
    skipNextAutosave.current = true;
    setClearVersion((version) => version + 1);
    setError("");
    try {
      await pendingSave.current.catch(() => {});
      await deleteWorkspaceDraft(userId, draftType, draftKey);
      setRestoreState({ identity, restored: false });
      setLoadState((current) => current.identity === identity
        ? { ...current, failed: false }
        : current);
    } catch (clearError) {
      setError(clearError.message || "The draft could not be discarded.");
      throw clearError;
    }
  }, [identity, userId, draftType, draftKey]);

  useEffect(() => {
    if (!enabled || !loaded || !ready || !userId || !draftKey || loadFailed || !shouldSave(valueRef.current)) return undefined;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return undefined;
    }
    const snapshot = serializedValue;
    const revision = ++latestRevision.current;
    autosaveTimer.current = window.setTimeout(() => {
      if (revision !== latestRevision.current) return;
      setSaveState({ identity, saving: true });
      const operation = enqueueSave(JSON.parse(snapshot), revision)
        .then(() => {
          if (revision === latestRevision.current) {
            setError("");
            setRestoreState({ identity, restored: true });
          }
        })
        .catch((saveError) => setError(saveError.message || "The draft could not be autosaved."))
        .finally(() => {
          if (revision === latestRevision.current) setSaveState({ identity, saving: false });
        });
      pendingSave.current = operation;
    }, 900);
    return () => window.clearTimeout(autosaveTimer.current);
  }, [serializedValue, enabled, loaded, ready, userId, draftType, draftKey, loadFailed, shouldSave, clearVersion, enqueueSave, identity]);

  return { loaded, saving, error, restored, saveNow, clear };
}
