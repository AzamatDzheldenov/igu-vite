import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeContent } from './contentValidation.js'
import { seedContent } from './seedContent.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.join(__dirname, 'data')
const dbPath = process.env.DB_PATH || path.join(dataDir, 'igu.sqlite')
const isProduction = process.env.NODE_ENV === 'production'

const devUsers = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'smm', password: 'smm123', role: 'smm' },
]
const allowedRoles = new Set(['admin', 'smm'])
const weakProductionPasswords = new Set(['admin123', 'smm123', 'password', '12345678'])

fs.mkdirSync(dataDir, { recursive: true })

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

export function initializeDatabase() {
  createBaseSchema()
  createAuditSchema()
  migrateUserSchema()
  migrateApplicationSchema()
  ensureInitialUsers()
  seedSiteContent()
  migrateSiteContent()
  clearExpiredSessions()
}

export function findUserByUsername(username) {
  const normalizedUsername = normalizeUsername(username)

  if (!normalizedUsername) {
    return null
  }

  return db
    .prepare(
      `SELECT id, username, password_hash, role, is_active, created_at, last_login_at
       FROM users
       WHERE username = ? OR login = ?
       LIMIT 1`,
    )
    .get(normalizedUsername, normalizedUsername) || null
}

export function markUserLogin(userId) {
  db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId)
}

export function clearExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
}

export function createApplication(application) {
  const result = db
    .prepare(
      `INSERT INTO applications (name, phone, email, program, message, ip, user_agent)
       VALUES (@name, @phone, @email, @program, @message, @ip, @userAgent)`,
    )
    .run(application)

  return result.lastInsertRowid
}

export function listApplications(options = {}) {
  const query = buildApplicationQuery(options)
  const total = db.prepare(`SELECT COUNT(*) AS total FROM applications ${query.whereSql}`).get(query.params).total
  const totalPages = Math.max(1, Math.ceil(total / query.limit))
  const page = Math.min(query.page, totalPages)
  const offset = (page - 1) * query.limit
  const items = db
    .prepare(
      `SELECT id, name, phone, email, program, message, status, ip, user_agent, created_at
       FROM applications
       ${query.whereSql}
       ORDER BY ${query.orderSql}, id DESC
       LIMIT @limit OFFSET @offset`,
    )
    .all({ ...query.params, limit: query.limit, offset })
  const counts = getApplicationCounts(query.searchWhereSql, query.searchParams)

  return {
    items,
    pagination: {
      page,
      limit: query.limit,
      total,
      totalPages,
    },
    counts,
  }
}

export function listApplicationsForExport(options = {}) {
  const query = buildApplicationQuery({ ...options, page: 1, limit: 100000 })

  return db
    .prepare(
      `SELECT id, created_at, name, phone, email, program, message, status, ip, user_agent
       FROM applications
       ${query.whereSql}
       ORDER BY ${query.orderSql}, id DESC`,
    )
    .all(query.params)
}

export function updateApplicationStatus(id, status) {
  const result = db
    .prepare('UPDATE applications SET status = ? WHERE id = ?')
    .run(status, id)

  return result.changes > 0
}

export function getSiteContent() {
  const row = db.prepare('SELECT content_json FROM site_content WHERE id = 1').get()
  return row ? normalizeContent(JSON.parse(row.content_json)) : normalizeContent(seedContent)
}

export function updateSiteContent(content) {
  const normalized = normalizeContent(content)
  db.prepare(
    'UPDATE site_content SET content_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
  ).run(JSON.stringify(normalized))
  return getSiteContent()
}

export function logAuditEvent(event = {}) {
  try {
    const action = normalizeAuditText(event.action, 80)

    if (!action) {
      return
    }

    db.prepare(
      `INSERT INTO audit_logs (username, role, action, entity_type, entity_id, ip, user_agent)
       VALUES (@username, @role, @action, @entityType, @entityId, @ip, @userAgent)`,
    ).run({
      username: normalizeAuditText(event.username, 120),
      role: normalizeAuditText(event.role, 40),
      action,
      entityType: normalizeAuditText(event.entityType, 80),
      entityId: normalizeAuditText(event.entityId, 120),
      ip: normalizeAuditText(event.ip, 120),
      userAgent: normalizeAuditText(event.userAgent, 300),
    })
  } catch (error) {
    console.error(`[audit] write_failed message=${String(error.message || 'unknown').replace(/\s+/g, '_').slice(0, 160)}`)
  }
}

export function listAuditLogs(options = {}) {
  const page = Math.max(1, Number(options.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20))
  const search = typeof options.search === 'string' ? options.search.trim().slice(0, 120) : ''
  const action = typeof options.action === 'string' ? options.action.trim().slice(0, 80) : ''
  const conditions = []
  const params = {}

  if (search) {
    params.search = `%${search.toLowerCase()}%`
    conditions.push(
      `(LOWER(COALESCE(username, '')) LIKE @search
        OR LOWER(COALESCE(role, '')) LIKE @search
        OR LOWER(action) LIKE @search
        OR LOWER(COALESCE(entity_type, '')) LIKE @search
        OR LOWER(COALESCE(entity_id, '')) LIKE @search
        OR LOWER(COALESCE(ip, '')) LIKE @search)`,
    )
  }

  if (action && action !== 'all') {
    params.action = action
    conditions.push('action = @action')
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const total = db.prepare(`SELECT COUNT(*) AS total FROM audit_logs ${whereSql}`).get(params).total
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * limit
  const items = db
    .prepare(
      `SELECT id, username, role, action, entity_type, entity_id, ip, user_agent, created_at
       FROM audit_logs
       ${whereSql}
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit, offset })
  const actions = db
    .prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action ASC')
    .all()
    .map((row) => row.action)

  return {
    items,
    actions,
    pagination: {
      page: currentPage,
      limit,
      total,
      totalPages,
    },
  }
}

function createBaseSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      login TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS site_content (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      content_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      program TEXT,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS applications_created_at_idx ON applications(created_at);
    CREATE INDEX IF NOT EXISTS applications_email_idx ON applications(email);
  `)
}

function createAuditSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS audit_logs_username_idx ON audit_logs(username);
  `)
}

function migrateApplicationSchema() {
  const columns = getTableColumns('applications')

  addColumnIfMissingForTable(columns, 'applications', 'status', "TEXT NOT NULL DEFAULT 'new'")
  addColumnIfMissingForTable(columns, 'applications', 'ip', 'TEXT')

  if (columns.has('ip_address')) {
    db.prepare("UPDATE applications SET ip = ip_address WHERE (ip IS NULL OR TRIM(ip) = '') AND ip_address IS NOT NULL").run()
  }

  db.prepare("UPDATE applications SET status = 'new' WHERE status IS NULL OR status NOT IN ('new', 'in_progress', 'done', 'rejected')").run()
}

function buildApplicationQuery(options) {
  const page = Math.max(1, Number(options.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 20))
  const status = ['new', 'in_progress', 'done', 'rejected'].includes(options.status)
    ? options.status
    : 'all'
  const search = typeof options.search === 'string' ? options.search.trim().slice(0, 120) : ''
  const sort = options.sort === 'created_at_asc' ? 'created_at_asc' : 'created_at_desc'
  const conditions = []
  const params = {}
  const searchWhereSql = buildApplicationSearchCondition(search, params)

  if (searchWhereSql) {
    conditions.push(searchWhereSql)
  }

  if (status !== 'all') {
    conditions.push('status = @status')
    params.status = status
  }

  return {
    page,
    limit,
    status,
    search,
    params,
    whereSql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    searchWhereSql: searchWhereSql ? `WHERE ${searchWhereSql}` : '',
    searchParams: search ? { search: params.search } : {},
    orderSql: sort === 'created_at_asc' ? 'datetime(created_at) ASC' : 'datetime(created_at) DESC',
  }
}

function buildApplicationSearchCondition(search, params) {
  if (!search) {
    return ''
  }

  params.search = `%${search.toLowerCase()}%`
  return [
    'LOWER(name) LIKE @search',
    'LOWER(phone) LIKE @search',
    "LOWER(COALESCE(email, '')) LIKE @search",
    "LOWER(COALESCE(program, '')) LIKE @search",
    "LOWER(COALESCE(message, '')) LIKE @search",
  ].map((condition, index, conditions) => {
    if (index === 0) {
      return `(${condition}`
    }

    if (index === conditions.length - 1) {
      return `${condition})`
    }

    return condition
  }).join(' OR ')
}

function getApplicationCounts(searchWhereSql, searchParams) {
  const rows = db
    .prepare(
      `SELECT status, COUNT(*) AS total
       FROM applications
       ${searchWhereSql}
       GROUP BY status`,
    )
    .all(searchParams)
  const counts = { all: 0, new: 0, in_progress: 0, done: 0, rejected: 0 }

  rows.forEach((row) => {
    if (Object.hasOwn(counts, row.status)) {
      counts[row.status] = row.total
      counts.all += row.total
    }
  })

  return counts
}

function migrateUserSchema() {
  const columns = getTableColumns('users')

  addColumnIfMissing(columns, 'username', 'TEXT')
  addColumnIfMissing(columns, 'login', 'TEXT')
  addColumnIfMissing(columns, 'is_active', 'INTEGER NOT NULL DEFAULT 1')
  addColumnIfMissing(columns, 'last_login_at', 'TEXT')

  const refreshedColumns = getTableColumns('users')

  if (refreshedColumns.has('login')) {
    db.prepare("UPDATE users SET username = login WHERE (username IS NULL OR TRIM(username) = '') AND login IS NOT NULL").run()
  }

  db.prepare("UPDATE users SET username = 'user-' || id WHERE username IS NULL OR TRIM(username) = ''").run()
  db.prepare("UPDATE users SET login = username WHERE login IS NULL OR TRIM(login) = ''").run()
  db.prepare("UPDATE users SET role = 'admin' WHERE role IS NULL OR role NOT IN ('admin', 'smm')").run()
  db.prepare('UPDATE users SET is_active = 1 WHERE is_active IS NULL').run()

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username);
    CREATE UNIQUE INDEX IF NOT EXISTS users_login_unique ON users(login) WHERE login IS NOT NULL;
  `)
}

function ensureInitialUsers() {
  const configuredAdmin = getConfiguredUser('ADMIN')
  const configuredSmm = getConfiguredUser('SMM')

  if (isProduction) {
    if (!hasActiveAdmin()) {
      if (!configuredAdmin) {
        throw new Error(
          'Production startup requires an existing active admin user or ADMIN_LOGIN/ADMIN_PASSWORD for first bootstrap.',
        )
      }

      validateProductionPassword(configuredAdmin.password, 'ADMIN_PASSWORD')
      createUserIfMissing(configuredAdmin.username, configuredAdmin.password, 'admin')
    }

    if (configuredSmm) {
      validateProductionPassword(configuredSmm.password, 'SMM_PASSWORD')
      createUserIfMissing(configuredSmm.username, configuredSmm.password, 'smm')
    }

    return
  }

  createUserIfMissing(
    configuredAdmin?.username || devUsers[0].username,
    configuredAdmin?.password || devUsers[0].password,
    'admin',
  )
  createUserIfMissing(
    configuredSmm?.username || devUsers[1].username,
    configuredSmm?.password || devUsers[1].password,
    'smm',
  )
}

function getConfiguredUser(prefix) {
  const username = normalizeUsername(process.env[`${prefix}_LOGIN`])
  const password = process.env[`${prefix}_PASSWORD`] || ''

  if ((username && !password) || (!username && password)) {
    throw new Error(`${prefix}_LOGIN and ${prefix}_PASSWORD must be set together.`)
  }

  if (!username || !password) {
    return null
  }

  return { username, password }
}

function createUserIfMissing(username, password, role) {
  const normalizedUsername = normalizeUsername(username)

  if (!normalizedUsername) {
    throw new Error('Initial user username cannot be empty.')
  }

  if (!allowedRoles.has(role)) {
    throw new Error(`Unsupported user role: ${role}`)
  }

  const existing = findUserByUsername(normalizedUsername)

  if (existing) {
    return existing
  }

  const passwordHash = bcrypt.hashSync(password, 12)
  const result = db
    .prepare(
      `INSERT INTO users (username, login, password_hash, role, is_active)
       VALUES (?, ?, ?, ?, 1)`,
    )
    .run(normalizedUsername, normalizedUsername, passwordHash, role)

  console.info(`[security] initial_${role}_created username=${normalizedUsername}`)

  return {
    id: result.lastInsertRowid,
    username: normalizedUsername,
    role,
    is_active: 1,
  }
}

function hasActiveAdmin() {
  return Boolean(db.prepare("SELECT 1 FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1").get())
}

function validateProductionPassword(password, envName) {
  if (password.length < 12 || weakProductionPasswords.has(password.toLowerCase())) {
    throw new Error(`${envName} is too weak for production. Use at least 12 characters and avoid default passwords.`)
  }
}

function getTableColumns(tableName) {
  return new Set(db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name))
}

function addColumnIfMissing(columns, columnName, definition) {
  if (!columns.has(columnName)) {
    db.exec(`ALTER TABLE users ADD COLUMN ${columnName} ${definition};`)
    columns.add(columnName)
  }
}

function addColumnIfMissingForTable(columns, tableName, columnName, definition) {
  if (!columns.has(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`)
    columns.add(columnName)
  }
}

function normalizeUsername(username) {
  return typeof username === 'string' ? username.trim() : ''
}

function normalizeAuditText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function seedSiteContent() {
  const existing = db.prepare('SELECT id FROM site_content WHERE id = 1').get()

  if (existing) {
    return
  }

  db.prepare('INSERT INTO site_content (id, content_json) VALUES (1, ?)').run(
    JSON.stringify(seedContent),
  )
}

function migrateSiteContent() {
  const normalized = getSiteContent()
  db.prepare(
    'UPDATE site_content SET content_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
  ).run(JSON.stringify(normalized))
}
