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
  migrateUserSchema()
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
  `)
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

function normalizeUsername(username) {
  return typeof username === 'string' ? username.trim() : ''
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
