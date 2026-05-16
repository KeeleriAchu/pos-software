import { supabaseAdmin } from '../utils/supabaseAdmin.js'
import { writeFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import { format } from 'date-fns'
import { logger } from '../utils/logger.js'

const BACKUP_DIR = process.env.BACKUP_DIR || './backups'
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30

// Tables to backup in order (respects foreign keys)
const TABLES = ['customers','products','bills','bill_items','pending_payments','payment_history','reminders_log','customer_visits','audit_log']

export async function runBackup() {
  const ts = format(new Date(), 'yyyy-MM-dd_HH-mm')
  const backupPath = join(BACKUP_DIR, `pos_backup_${ts}`)

  try {
    mkdirSync(backupPath, { recursive: true })
    logger.info(`Starting backup: ${backupPath}`)

    const backup = { version: '1.0', timestamp: new Date().toISOString(), tables: {} }

    // Export each table
    for (const table of TABLES) {
      const { data, error } = await supabaseAdmin.from(table).select('*').order('created_at', { ascending: true })
      if (error) { logger.warn(`Skipping table ${table}: ${error.message}`); continue }
      backup.tables[table] = { count: (data||[]).length, rows: data||[] }
      logger.info(`  Backed up ${table}: ${(data||[]).length} rows`)
    }

    // Write main backup JSON
    const backupFile = join(backupPath, 'backup.json')
    writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf-8')

    // Write SQL-style restore script
    const sqlFile = join(backupPath, 'restore.sql')
    const sql = generateRestoreSQL(backup)
    writeFileSync(sqlFile, sql, 'utf-8')

    // Write summary
    const summary = {
      timestamp: backup.timestamp,
      tables: Object.fromEntries(Object.entries(backup.tables).map(([k,v]) => [k, v.count])),
      totalRows: Object.values(backup.tables).reduce((s,t) => s + t.count, 0),
      backupPath,
    }
    writeFileSync(join(backupPath, 'summary.json'), JSON.stringify(summary, null, 2))

    logger.info(`Backup complete: ${summary.totalRows} total rows`)

    // Clean up old backups
    await cleanOldBackups()

    return summary
  } catch (err) {
    logger.error('Backup failed', { error: err.message })
    throw err
  }
}

function generateRestoreSQL(backup) {
  const lines = [
    '-- POS Manager Database Restore Script',
    `-- Generated: ${backup.timestamp}`,
    '-- Run in Supabase SQL Editor to restore',
    '',
    'BEGIN;',
    ''
  ]

  for (const table of TABLES) {
    const tableData = backup.tables[table]
    if (!tableData || tableData.rows.length === 0) continue

    lines.push(`-- ── ${table.toUpperCase()} (${tableData.count} rows) ──`)
    for (const row of tableData.rows) {
      const cols = Object.keys(row).join(', ')
      const vals = Object.values(row).map(v => {
        if (v === null) return 'NULL'
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
        if (typeof v === 'number') return v
        return `'${String(v).replace(/'/g, "''")}'`
      }).join(', ')
      lines.push(`INSERT INTO ${table} (${cols}) VALUES (${vals}) ON CONFLICT (id) DO NOTHING;`)
    }
    lines.push('')
  }

  lines.push('COMMIT;')
  return lines.join('\n')
}

async function cleanOldBackups() {
  try {
    const dirs = readdirSync(BACKUP_DIR)
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    for (const dir of dirs) {
      const fullPath = join(BACKUP_DIR, dir)
      try {
        const stat = statSync(fullPath)
        if (stat.isDirectory() && stat.mtimeMs < cutoff) {
          // Delete old backup directory recursively
          const files = readdirSync(fullPath)
          for (const f of files) unlinkSync(join(fullPath, f))
          require('fs').rmdirSync(fullPath)
          logger.info(`Deleted old backup: ${dir}`)
        }
      } catch {}
    }
  } catch {}
}

export async function getBackupList() {
  try {
    mkdirSync(BACKUP_DIR, { recursive: true })
    const dirs = readdirSync(BACKUP_DIR)
    const backups = []
    for (const dir of dirs) {
      try {
        const summaryPath = join(BACKUP_DIR, dir, 'summary.json')
        const summary = JSON.parse(require('fs').readFileSync(summaryPath, 'utf-8'))
        backups.push(summary)
      } catch {}
    }
    return backups.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
  } catch { return [] }
}
