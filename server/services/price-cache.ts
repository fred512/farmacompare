import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { ResultadoPreco } from '~/types'

const TTL_MS = 12 * 60 * 60 * 1000
let database: Database.Database | undefined

function getDatabase() {
  if (database) return database
  const filename = resolve(process.env.DATABASE_PATH || './data/farmacompare.db')
  mkdirSync(dirname(filename), { recursive: true })
  database = new Database(filename)
  database.pragma('journal_mode = WAL')
  database.exec(`
    CREATE TABLE IF NOT EXISTS price_cache (
      cache_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_price_cache_expires_at ON price_cache(expires_at);
  `)
  database.prepare('DELETE FROM price_cache WHERE expires_at <= ?').run(Date.now())
  return database
}

export function getCachedPrice(ean: string, farmacia: string): ResultadoPreco | null {
  const key = cacheKey(ean, farmacia)
  const row = getDatabase().prepare('SELECT payload, expires_at FROM price_cache WHERE cache_key = ?').get(key) as { payload: string; expires_at: number } | undefined
  if (!row) return null
  if (row.expires_at <= Date.now()) {
    getDatabase().prepare('DELETE FROM price_cache WHERE cache_key = ?').run(key)
    return null
  }
  try { return JSON.parse(row.payload) as ResultadoPreco } catch { return null }
}

export function setCachedPrice(ean: string, farmacia: string, result: ResultadoPreco) {
  getDatabase().prepare(`
    INSERT INTO price_cache (cache_key, payload, expires_at) VALUES (?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, expires_at = excluded.expires_at
  `).run(cacheKey(ean, farmacia), JSON.stringify(result), Date.now() + TTL_MS)
}

function cacheKey(ean: string, farmacia: string) {
  return `v4:${ean}:${farmacia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()}`
}
