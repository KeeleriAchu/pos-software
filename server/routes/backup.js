import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { runBackup, getBackupList } from '../services/backup.js'
import { supabaseAdmin } from '../utils/supabaseAdmin.js'
import { logger } from '../utils/logger.js'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const router = Router()
router.use(requireAuth)

// GET /api/backup/list
router.get('/list', async (req, res) => {
  try {
    const backups = await getBackupList()
    res.json({ data: backups })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/backup/run — Trigger manual backup
router.post('/run', async (req, res) => {
  try {
    logger.info('Manual backup triggered', { userId: req.userId })
    const summary = await runBackup()
    res.json({ success: true, summary })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/backup/download/:name — Download backup JSON
router.get('/download/:name', async (req, res) => {
  try {
    const BACKUP_DIR = process.env.BACKUP_DIR || './backups'
    const safeDir = req.params.name.replace(/[^a-zA-Z0-9_\-]/g, '')
    const filePath = join(BACKUP_DIR, safeDir, 'backup.json')
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' })
    const data = readFileSync(filePath, 'utf-8')
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename=pos_backup_${safeDir}.json`)
    res.send(data)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/backup/export/csv — Export all data as CSV bundle
router.get('/export/csv', async (req, res) => {
  try {
    const tables = ['customers', 'products', 'bills', 'bill_items', 'pending_payments']
    const csvBundle = {}
    for (const table of tables) {
      const { data } = await supabaseAdmin.from(table).select('*').order('created_at', { ascending: true })
      if (!data?.length) { csvBundle[table] = ''; continue }
      const headers = Object.keys(data[0]).join(',')
      const rows = data.map(row =>
        Object.values(row).map(v =>
          v === null ? '' : typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g,'""')}"` : String(v)
        ).join(',')
      )
      csvBundle[table] = [headers, ...rows].join('\n')
    }
    res.json({ data: csvBundle, timestamp: new Date().toISOString() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

export default router
