export function normalizeBasePath(value = '/') {
  const raw = typeof value === 'string' && value.trim() ? value.trim() : '/'

  if (raw === '/') {
    return '/'
  }

  return `/${raw.replace(/^\/+|\/+$/g, '')}`
}
