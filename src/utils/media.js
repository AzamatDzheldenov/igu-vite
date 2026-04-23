export function mediaUrl(url) {
  if (!url || typeof url !== 'string') {
    return ''
  }

  if (!url.startsWith('/uploads')) {
    return url
  }

  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return `http://127.0.0.1:4000${url}`
  }

  return url
}
