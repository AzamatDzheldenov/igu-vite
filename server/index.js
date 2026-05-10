import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { fileTypeFromFile } from 'file-type'
import helmet from 'helmet'
import multer from 'multer'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeContent } from './contentValidation.js'
import {
  clearExpiredSessions,
  createApplication,
  db,
  findUserByUsername,
  getSiteContent,
  initializeDatabase,
  listApplications,
  listApplicationsForExport,
  markUserLogin,
  updateApplicationStatus,
  updateSiteContent,
} from './db.js'
import { appLog, errorLog, requestLogger, securityLog } from './logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const uploadDir = path.join(__dirname, 'uploads')
const app = express()
const port = Number(process.env.PORT || 4000)
const isProduction = process.env.NODE_ENV === 'production'
const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'igu_admin_session'
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
  image: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
}

const allowedExtensions = {
  image: new Set(['.jpg', '.jpeg', '.png', '.webp']),
  video: new Set(['.mp4', '.webm', '.mov']),
  document: new Set(['.pdf', '.doc', '.docx']),
}

const blockedExtensions = new Set(['.html', '.htm', '.svg', '.js', '.mjs', '.exe', '.sh', '.bat', '.cmd', '.php'])
const allowedApplicationStatuses = new Set(['new', 'in_progress', 'done', 'rejected'])
const maxCsvExportRows = 10000

fs.mkdirSync(uploadDir, { recursive: true })

try {
  initializeDatabase()
} catch (error) {
  appLog('error', 'startup_failed', { errorMessage: error.message })
  process.exit(1)
}

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", 'https://www.youtube.com', 'https://youtube.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
)
app.use(requestLogger)
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use(
  '/uploads',
  express.static(uploadDir, {
    setHeaders: (response) => {
      response.setHeader('X-Content-Type-Options', 'nosniff')
      response.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    },
  }),
)
app.use(verifySameOriginForStateChangingRequests)

const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: { message: 'Слишком много запросов. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  message: { message: 'Слишком много попыток входа. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const applicationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { message: 'Слишком много заявок. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { message: 'Слишком много загрузок. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const adminContentSaveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: { message: 'Слишком много изменений. Попробуйте позже.' },
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
    const safeExt = isAllowedExtensionForAnyType(ext) ? ext : '.bin'
    callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${safeExt}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: uploadLimits.video },
  fileFilter: (_request, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const type = inferType(file.mimetype)

    if (!type || blockedExtensions.has(ext) || !allowedExtensions[type]?.has(ext)) {
      return callback(new Error('Недопустимый тип файла.'))
    }

    return callback(null, true)
  },
})

app.use('/api', generalApiLimiter)

app.get('/api/content', (_request, response) => {
  response.json(getSiteContent())
})

app.post('/api/applications', applicationLimiter, (request, response) => {
  const application = normalizeApplication(request)

  if (!application) {
    securityLog('application_rejected_validation', request)
    return response.status(400).json({ message: 'Заполните обязательные поля.' })
  }

  const applicationId = createApplication(application)
  securityLog('application_created', request, { applicationId })
  notifyTelegramApplication(application, applicationId)

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

app.get('/api/admin/applications', requireAdmin, (request, response) => {
  response.json(listApplications(getApplicationListOptions(request.query)))
})

app.get('/api/admin/applications/export.csv', requireAdmin, (request, response) => {
  const rows = listApplicationsForExport(getApplicationListOptions(request.query))

  if (rows.length > maxCsvExportRows) {
    return response.status(413).json({
      message: `Слишком много заявок для экспорта. Уточните фильтр до ${maxCsvExportRows} строк.`,
    })
  }

  const csv = buildApplicationsCsv(rows)
  const date = new Date().toISOString().slice(0, 10)

  response.setHeader('Content-Type', 'text/csv; charset=utf-8')
  response.setHeader('Content-Disposition', `attachment; filename="applications-${date}.csv"`)
  response.send(csv)
})

app.patch('/api/admin/applications/:id/status', adminContentSaveLimiter, requireAdmin, (request, response) => {
  const applicationId = Number(request.params.id)
  const status = typeof request.body?.status === 'string' ? request.body.status : ''

  if (!Number.isInteger(applicationId) || applicationId <= 0 || !allowedApplicationStatuses.has(status)) {
    return response.status(400).json({ message: 'Некорректный статус заявки.' })
  }

  const updated = updateApplicationStatus(applicationId, status)

  if (!updated) {
    return response.status(404).json({ message: 'Заявка не найдена.' })
  }

  securityLog('application_status_updated', request, { applicationId, status })
  response.json({ ok: true })
})

app.post('/api/admin/uploads', uploadLimiter, requireEditor, upload.single('file'), async (request, response) => {
  if (!request.file) {
    return response.status(400).json({ message: 'Приложите файл.' })
  }

  const requestedType = typeof request.body?.type === 'string' ? request.body.type : inferType(request.file.mimetype)
  const validation = await validateUploadedFile(request.file, requestedType)

  if (!validation.ok) {
    await removeUploadedFile(request.file.path)
    securityLog('upload_rejected', request, { reason: validation.reason, fileName: request.file.originalname })
    return response.status(400).json({ error: 'Invalid file type', message: 'Недопустимый тип файла.' })
  }

  if (request.file.size > uploadLimits[validation.type]) {
    await removeUploadedFile(request.file.path)
    return response.status(413).json({ message: limitMessage(validation.type) })
  }

  const relativeUrl = `/uploads/${validation.type}s/${request.file.filename}`

  return response.status(201).json({
    url: relativeUrl,
    name: request.file.originalname,
    type: validation.type,
    mimeType: validation.mime,
    size: request.file.size,
  })
})

app.put('/api/admin/content', adminContentSaveLimiter, requireEditor, (request, response) => {
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

app.use((error, request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return response.status(413).json({ message: 'Файл слишком большой. Максимум для видео: 50 МБ.' })
  }

  if (error?.message === 'Недопустимый тип файла.') {
    securityLog('upload_rejected_prefilter', request, { reason: 'extension_or_mime' })
    return response.status(400).json({ error: 'Invalid file type', message: 'Недопустимый тип файла.' })
  }

  errorLog('unhandled_request_error', error, request)
  const payload = isProduction
    ? { error: 'Internal server error' }
    : { message: error.message || 'Внутренняя ошибка сервера.' }

  return response.status(500).json(payload)
})

app.listen(port, () => {
  appLog('info', 'server_started', {
    url: `http://127.0.0.1:${port}`,
    nodeEnv: process.env.NODE_ENV || 'development',
  })

  if (!isProduction) {
    appLog('info', 'development_auth_bootstrap_enabled', {
      users: 'admin/admin123,smm/smm123',
    })
  }
})

function requireEditor(request, response, next) {
  return requireRoles(['admin', 'smm'])(request, response, next)
}

function requireAdmin(request, response, next) {
  return requireRoles(['admin'])(request, response, next)
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

function normalizeApplication(request) {
  const name = asText(request.body?.name, 120)
  const phone = asText(request.body?.phone, 40)
  const email = asText(request.body?.email, 160).toLowerCase()
  const program = asText(request.body?.program, 240)
  const message = asText(request.body?.message, 500)

  if (
    name.length < 2 ||
    !/^[+()\d\s-]{10,20}$/.test(phone) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !program
  ) {
    return null
  }

  return {
    name,
    phone,
    email,
    program,
    message,
    ip: request.ip || '',
    userAgent: asText(request.get('user-agent'), 300),
  }
}

function getApplicationListOptions(query) {
  return {
    page: query.page,
    limit: query.limit,
    status: query.status,
    search: query.search,
    sort: query.sort,
  }
}

function notifyTelegramApplication(application, applicationId) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    return
  }

  const text = [
    `Новая заявка #${applicationId}`,
    `Имя: ${application.name}`,
    `Телефон: ${application.phone}`,
    `Email: ${application.email || '-'}`,
    `Программа: ${application.program || '-'}`,
    application.message ? `Сообщение: ${application.message}` : '',
  ].filter(Boolean).join('\n')

  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  }).catch((error) => {
    appLog('error', 'telegram_notification_failed', { errorMessage: error.message })
  })
}

function buildApplicationsCsv(rows) {
  const columns = ['id', 'created_at', 'name', 'phone', 'email', 'program', 'message', 'status', 'ip', 'user_agent']
  const lines = [
    columns.join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
  ]

  return `\uFEFF${lines.join('\n')}\n`
}

function csvCell(value) {
  const text = value === undefined || value === null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function asText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

async function validateUploadedFile(file, requestedType) {
  const ext = path.extname(file.originalname).toLowerCase()
  const type = inferType(file.mimetype)

  if (!type || requestedType !== type) {
    return { ok: false, reason: 'type_mismatch' }
  }

  if (blockedExtensions.has(ext) || !allowedExtensions[type]?.has(ext)) {
    return { ok: false, reason: 'extension_not_allowed' }
  }

  if (!mimeGroups[type]?.includes(file.mimetype)) {
    return { ok: false, reason: 'mime_not_allowed' }
  }

  const detected = await fileTypeFromFile(file.path)

  if (!detected || !isAllowedDetectedType(type, ext, detected)) {
    return { ok: false, reason: 'magic_bytes_mismatch' }
  }

  return { ok: true, type, mime: normalizeDetectedMime(type, ext, detected.mime) }
}

function isAllowedDetectedType(type, ext, detected) {
  if (type === 'document' && ext === '.doc') {
    return detected.mime === 'application/x-cfb'
  }

  return mimeGroups[type]?.includes(detected.mime)
}

function normalizeDetectedMime(type, ext, detectedMime) {
  if (type === 'document' && ext === '.doc' && detectedMime === 'application/x-cfb') {
    return 'application/msword'
  }

  return detectedMime
}

function isAllowedExtensionForAnyType(ext) {
  return Object.values(allowedExtensions).some((extensions) => extensions.has(ext))
}

function inferType(mimeType) {
  return Object.entries(mimeGroups).find(([, mimes]) => mimes.includes(mimeType))?.[0] || null
}

async function removeUploadedFile(filePath) {
  await fs.promises.rm(filePath, { force: true })
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
