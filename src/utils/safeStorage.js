export const safeStorage = {
  get(key, fallback = null) {
    try {
      return localStorage.getItem(key) ?? fallback
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Storage can be unavailable in private mode or restricted WebViews.
    }
  },
}
