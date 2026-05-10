import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const rootDir = path.resolve(path.dirname(__filename), '..')
const sourceDbPath = path.resolve(rootDir, process.env.DB_PATH || 'server/data/igu.sqlite')
const sourceUploadDir = path.join(rootDir, 'server/uploads')
const backupRoot = path.join(rootDir, 'backups')
const timestamp = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-')
const backupDir = path.join(backupRoot, timestamp)

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function main() {
  await fs.mkdir(backupDir, { recursive: true })

  if (!(await pathExists(sourceDbPath))) {
    throw new Error(`SQLite database not found: ${sourceDbPath}`)
  }

  const databaseTarget = path.join(backupDir, 'database.sqlite')
  await fs.copyFile(sourceDbPath, databaseTarget)

  if (await pathExists(sourceUploadDir)) {
    await fs.cp(sourceUploadDir, path.join(backupDir, 'uploads'), {
      recursive: true,
      force: true,
      filter: (source) => path.basename(source) !== '.gitkeep',
    })
  }

  console.info(`[backup] created=${backupDir}`)
  console.info(`[backup] database=${databaseTarget}`)
  console.info(`[backup] uploads=${await pathExists(sourceUploadDir) ? 'copied' : 'skipped'}`)
}

main().catch((error) => {
  console.error(`[backup] failed message=${error.message}`)
  process.exit(1)
})
