import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import multer from 'multer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeContent } from './contentValidation.js'
import {
  clearExpiredSessions,
  db,
  findUserByUsername,
  getSiteContent,
  initializeDatabase,
  markUserLogin,
  updateSiteContent,
} from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const uploadDir = path.join(__dirname, 'uploads')
const app = express()
const port = Number(process.env.PORT || 4000)
const isProduction = process.env.NODE_ENV === 'production'
const sessionCookieName = 'igu_admin_session'
const sessionTtlMs = 1000 * 60 * 60 * 8
const allowedOrigins = buildAllowedOrigins()

if (isProduction) {
  app.set('trust proxy', 1)
}

const uploadLimits = {
  image: 10 * 1024 * 1024,
  document: 25 * 1024 * 1024,
  video: 50 * 1024 * 1024,
}

const mimeGroups = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
}

fs.mkdirSync(uploadDir, { recursive: true })

try {
  initializeDatabase()
} catch (error) {
  console.error(`[security] startup_failed message=${sanitizeLogValue(error.message)}`)
  process.exit(1)
}

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
)
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use('/uploads', express.static(uploadDir))
app.use(verifySameOriginForStateChangingRequests)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  message: { message: 'Слишком много попыток входа. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const storage = multer.diskStorage({
  destination: (_request, file, callback) => {
    const type = inferType(file.mimetype)
    const destination = path.join(uploadDir, `${type}s`)
    fs.mkdirSync(destination, { recursive: true })
    callback(null, destination)
  },
  filename: (_request, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const safeExt = ext.replace(/[^a-z0-9.]/g, '') || '.bin'
    callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: uploadLimits.video },
  fileFilter: (_request, file, callback) => {
    const type = inferType(file.mimetype)

    if (!type) {
      return callback(new Error('Недопустимый тип файла.'))
    }

    return callback(null, true)
  },
})

app.get('/api/content', (_request, response) => {
  response.json(getSiteContent())
})

app.post('/api/applications', (request, response) => {
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : ''
  const phone = typeof request.body?.phone === 'string' ? request.body.phone.trim() : ''
  const email = typeof request.body?.email === 'string' ? request.body.email.trim() : ''
  const program = typeof request.body?.program === 'string' ? request.body.program.trim() : ''

  if (!name || !phone || !email || !program) {
    return response.status(400).json({ message: 'Заполните обязательные поля.' })
  }

  return response.status(201).json({ ok: true })
})

app.post('/api/auth/login', authLimiter, (request, response) => {
  const username = typeof request.body?.login === 'string' ? request.body.login.trim() : ''
  const password = typeof request.body?.password === 'string' ? request.body.password : ''

  if (!username || !password) {
    return response.status(400).json({ message: 'Введите логин и пароль.' })
  }

  const user = findUserByUsername(username)
  const hasValidPassword = user ? bcrypt.compareSync(password, user.password_hash) : false

  if (!user || !user.is_active || !['admin', 'smm'].includes(user.role) || !hasValidPassword) {
    securityLog('login_failed', request, { username })
    return response.status(401).json({ message: 'Неверный логин или пароль.' })
  }

  clearExpiredSessions()
  markUserLogin(user.id)

  const sessionId = crypto.randomBytes(32).toString('hex')
  const expiresAt = Date.now() + sessionTtlMs

  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
    sessionId,
    user.id,
    expiresAt,
  )

  response.cookie(sessionCookieName, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: sessionTtlMs,
    path: '/',
  })

  securityLog('login_success', request, { username: user.username, role: user.role })

  return response.json({ user: { login: user.username, username: user.username, role: user.role } })
})

app.post('/api/auth/logout', (request, response) => {
  const sessionId = request.cookies?.[sessionCookieName]
  const session = sessionId ? getSessionUser(sessionId) : null

  if (sessionId) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
  }

  response.clearCookie(sessionCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
  })

  securityLog('logout', request, { username: session?.username || 'unknown' })
  response.json({ ok: true })
})

app.get('/api/auth/me', requireEditor, (request, response) => {
  response.json({ user: request.user })
})

app.post('/api/admin/uploads', requireEditor, upload.single('file'), (request, response) => {
  if (!request.file) {
    return response.status(400).json({ message: 'Приложите файл.' })
  }

  const inferredType = inferType(request.file.mimetype)
  const requestedType = typeof request.body?.type === 'string' ? request.body.type : inferredType

  if (!inferredType || requestedType !== inferredType) {
    removeUploadedFile(request.file.path)
    return response.status(400).json({ message: 'Тип файла не совпадает с выбранной категорией.' })
  }

  if (request.file.size > uploadLimits[inferredType]) {
    removeUploadedFile(request.file.path)
    return response.status(413).json({ message: limitMessage(inferredType) })
  }

  const relativeUrl = `/uploads/${inferredType}s/${request.file.filename}`

  return response.status(201).json({
    url: relativeUrl,
    name: request.file.originalname,
    type: inferredType,
    mimeType: request.file.mimetype,
    size: request.file.size,
  })
})

app.put('/api/admin/content', requireEditor, (request, response) => {
  const incoming =
    request.user.role === 'smm'
      ? buildSmmScopedContent(request)
      : request.body
  const normalized = normalizeContent(incoming)
  response.json(updateSiteContent(normalized))
})

if (isProduction) {
  app.use(express.static(distDir))
  app.get(/.*/, (_request, response) => {
    response.sendFile(path.join(distDir, 'index.html'))
  })
}

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return response.status(413).json({ message: 'Файл слишком большой. Максимум для видео: 50 МБ.' })
  }

  console.error(error)
  return response.status(500).json({ message: error.message || 'Внутренняя ошибка сервера.' })
})

app.listen(port, () => {
  console.log(`API server is running on http://127.0.0.1:${port}`)

  if (!isProduction) {
    console.log('Development auth bootstrap is enabled for missing users only.')
    console.log('Fallback development users: admin / admin123 and smm / smm123')
  }
})

function requireEditor(request, response, next) {
  return requireRoles(['admin', 'smm'])(request, response, next)
}

function requireRoles(roles) {
  return (request, response, next) => {
    const sessionId = request.cookies?.[sessionCookieName]

    if (!sessionId) {
      return response.status(401).json({ message: 'Требуется вход в панель управления.' })
    }

    const session = getSessionUser(sessionId)

    if (!session || session.expires_at <= Date.now()) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
      return response.status(401).json({ message: 'Сессия истекла. Войдите снова.' })
    }

    if (!session.is_active) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
      securityLog('access_denied_inactive_user', request, { username: session.username })
      return response.status(401).json({ message: 'Сессия недействительна. Войдите снова.' })
    }

    if (!roles.includes(session.role)) {
      securityLog('access_denied_role', request, {
        username: session.username,
        role: session.role,
        path: request.path,
      })
      return response.status(403).json({ message: 'Недостаточно прав для этого действия.' })
    }

    request.user = {
      id: session.user_id,
      login: session.username,
      username: session.username,
      role: session.role,
    }

    return next()
  }
}

function getSessionUser(sessionId) {
  return db
    .prepare(
      `SELECT sessions.id, sessions.expires_at, users.id AS user_id, users.username, users.role, users.is_active
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ?`,
    )
    .get(sessionId)
}

function buildSmmScopedContent(request) {
  const incomingKeys =
    request.body && typeof request.body === 'object' && !Array.isArray(request.body)
      ? Object.keys(request.body)
      : []
  const blockedKeys = incomingKeys.filter((key) => key !== 'news')

  if (blockedKeys.length > 0) {
    securityLog('smm_scope_enforced', request, {
      username: request.user.username,
      blockedKeys: blockedKeys.join(','),
    })
  }

  return { ...getSiteContent(), news: request.body?.news }
}

function verifySameOriginForStateChangingRequests(request, response, next) {
  if (!request.path.startsWith('/api') || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    return next()
  }

  const source = request.get('origin') || request.get('referer')

  if (!source) {
    if (!isProduction) {
      return next()
    }

    securityLog('csrf_blocked_missing_origin', request, { path: request.path })
    return response.status(403).json({ message: 'Запрос отклонен проверкой безопасности.' })
  }

  const sourceOrigin = parseOrigin(source)

  if (sourceOrigin && isAllowedOrigin(request, sourceOrigin)) {
    return next()
  }

  securityLog('csrf_blocked_origin', request, {
    origin: sourceOrigin || 'invalid',
    path: request.path,
  })
  return response.status(403).json({ message: 'Запрос отклонен проверкой безопасности.' })
}

function buildAllowedOrigins() {
  const configured = [process.env.PUBLIC_SITE_ORIGIN, process.env.ALLOWED_ORIGINS]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)

  const origins = new Set(configured)

  if (!isProduction) {
    origins.add('http://127.0.0.1:5173')
    origins.add('http://localhost:5173')
    origins.add('http://127.0.0.1:4000')
    origins.add('http://localhost:4000')
  }

  return origins
}

function isAllowedOrigin(request, sourceOrigin) {
  if (allowedOrigins.has(sourceOrigin)) {
    return true
  }

  const requestOrigin = getRequestOrigin(request)
  return Boolean(requestOrigin && requestOrigin === sourceOrigin)
}

function getRequestOrigin(request) {
  const host = request.get('x-forwarded-host') || request.get('host')

  if (!host) {
    return ''
  }

  const forwardedProto = request.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const protocol = forwardedProto || request.protocol
  return `${protocol}://${host}`
}

function parseOrigin(source) {
  try {
    return new URL(source).origin
  } catch {
    return ''
  }
}

function securityLog(event, request, details = {}) {
  const fields = {
    ip: request.ip,
    method: request.method,
    path: request.path,
    ...details,
  }

  const serialized = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${sanitizeLogValue(value)}`)
    .join(' ')

  console.info(`[security] ${event}${serialized ? ` ${serialized}` : ''}`)
}

function sanitizeLogValue(value) {
  return String(value).replace(/\s+/g, '_').slice(0, 180)
}

function inferType(mimeType) {
  return Object.entries(mimeGroups).find(([, mimes]) => mimes.includes(mimeType))?.[0] || null
}

function removeUploadedFile(filePath) {
  fs.rm(filePath, { force: true }, () => {})
}

function limitMessage(type) {
  if (type === 'image') {
    return 'Фото слишком большое. Максимум: 10 МБ.'
  }

  if (type === 'document') {
    return 'Документ слишком большой. Максимум: 25 МБ.'
  }

  return 'Видео слишком большое. Максимум: 50 МБ.'
}
