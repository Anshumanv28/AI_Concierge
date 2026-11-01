/**
 * Anonymous, browser-scoped identifier for chat history.
 * There's no login system, so history is tagged with a random ID stored in
 * localStorage - private to the browser it was created in, no accounts needed.
 */
const STORAGE_KEY = "ai_concierge_anon_id";

export const getAnonId = () => {
  if (typeof window === "undefined") return null;

  let anonId = window.localStorage.getItem(STORAGE_KEY);
  if (!anonId) {
    anonId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(STORAGE_KEY, anonId);
  }
  return anonId;
};

export default getAnonId;
