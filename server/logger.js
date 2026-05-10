import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const logDir = path.join(rootDir, 'logs')
const shouldWriteFile = process.env.LOG_TO_FILE === 'true'

if (shouldWriteFile) {
  fs.mkdirSync(logDir, { recursive: true })
}

export function requestLogger(request, response, next) {
  const startedAt = process.hrtime.bigint()

  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000

    log('info', 'request_completed', {
      request,
      details: {
        status: response.statusCode,
        durationMs: durationMs.toFixed(1),
      },
    })
  })

  next()
}

export function securityLog(event, request, details = {}) {
  log('security', event, { request, details })
}

export function errorLog(event, error, request, details = {}) {
  log('error', event, {
    request,
    details: {
      ...details,
      errorName: error?.name,
      errorMessage: error?.message,
      errorStack: process.env.NODE_ENV === 'production' ? undefined : error?.stack,
    },
  })
}

export function appLog(level, event, details = {}) {
  log(level, event, { details })
}

function log(level, event, { request, details = {} } = {}) {
  const fields = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ip: request ? getRequestIp(request) : undefined,
    method: request?.method,
    route: request?.originalUrl || request?.path,
    ...details,
  }

  const line = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${sanitizeLogValue(value)}`)
    .join(' ')

  const formatted = `[${level}] ${line}`

  if (level === 'error') {
    console.error(formatted)
  } else {
    console.info(formatted)
  }

  if (shouldWriteFile) {
    appendLogFile(level, formatted)
  }
}

function appendLogFile(level, formatted) {
  const fileName = level === 'error' ? 'error.log' : 'app.log'

  fs.appendFile(path.join(logDir, fileName), `${formatted}\n`, (error) => {
    if (error) {
      console.error(`[error] timestamp=${new Date().toISOString()} event=log_write_failed errorMessage=${sanitizeLogValue(error.message)}`)
    }
  })
}

function getRequestIp(request) {
  return request.ip || request.get('x-forwarded-for')?.split(',')[0]?.trim() || request.socket?.remoteAddress
}

function sanitizeLogValue(value) {
  return String(value).replace(/\s+/g, '_').slice(0, 500)
}
