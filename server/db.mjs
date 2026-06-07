import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'data', 'data.db');

// Ensure data dir exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    owner TEXT DEFAULT '',
    repo TEXT DEFAULT '',
    description TEXT DEFAULT '',
    remote_url TEXT DEFAULT '',
    github_url TEXT DEFAULT '',
    language TEXT DEFAULT '',
    topics TEXT DEFAULT '[]',
    last_commit_hash TEXT DEFAULT '',
    last_commit_message TEXT DEFAULT '',
    last_commit_date TEXT DEFAULT '',
    local_path TEXT NOT NULL,
    scanned_at TEXT DEFAULT '',
    stars INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    remote_commit_hash TEXT DEFAULT '',
    remote_commit_date TEXT DEFAULT '',
    compare_status TEXT DEFAULT '',
    ahead_by INTEGER DEFAULT 0,
    behind_by INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    question TEXT DEFAULT '',
    answer TEXT NOT NULL,
    context_summary TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
  CREATE INDEX IF NOT EXISTS idx_projects_language ON projects(language);
  CREATE INDEX IF NOT EXISTS idx_analysis_project ON analysis(project_id);
`);

// Upgrade schema if fields are missing in an existing database
const tableInfo = db.prepare("PRAGMA table_info(projects)").all();
const existingColumns = new Set(tableInfo.map(col => col.name));

const newColumns = [
  { name: 'stars', type: 'INTEGER DEFAULT 0' },
  { name: 'forks', type: 'INTEGER DEFAULT 0' },
  { name: 'remote_commit_hash', type: 'TEXT DEFAULT \'\'' },
  { name: 'remote_commit_date', type: 'TEXT DEFAULT \'\'' },
  { name: 'compare_status', type: 'TEXT DEFAULT \'\'' },
  { name: 'ahead_by', type: 'INTEGER DEFAULT 0' },
  { name: 'behind_by', type: 'INTEGER DEFAULT 0' },
];

for (const col of newColumns) {
  if (!existingColumns.has(col.name)) {
    try {
      db.exec(`ALTER TABLE projects ADD COLUMN ${col.name} ${col.type}`);
      console.log(`Successfully added missing column to SQLite: ${col.name}`);
    } catch (e) {
      console.error(`Failed to add column ${col.name}:`, e.message);
    }
  }
}

// Prepared statements
const upsertProject = db.prepare(`
  INSERT INTO projects (
    name, owner, repo, description, remote_url, github_url, language, topics,
    last_commit_hash, last_commit_message, last_commit_date, local_path, scanned_at,
    stars, forks, remote_commit_hash, remote_commit_date, compare_status, ahead_by, behind_by
  )
  VALUES (
    @name, @owner, @repo, @description, @remote_url, @github_url, @language, @topics,
    @last_commit_hash, @last_commit_message, @last_commit_date, @local_path, @scanned_at,
    @stars, @forks, @remote_commit_hash, @remote_commit_date, @compare_status, @ahead_by, @behind_by
  )
  ON CONFLICT(name) DO UPDATE SET
    owner = excluded.owner,
    repo = excluded.repo,
    description = excluded.description,
    remote_url = excluded.remote_url,
    github_url = excluded.github_url,
    language = excluded.language,
    topics = excluded.topics,
    last_commit_hash = excluded.last_commit_hash,
    last_commit_message = excluded.last_commit_message,
    last_commit_date = excluded.last_commit_date,
    local_path = excluded.local_path,
    scanned_at = excluded.scanned_at,
    stars = excluded.stars,
    forks = excluded.forks,
    remote_commit_hash = excluded.remote_commit_hash,
    remote_commit_date = excluded.remote_commit_date,
    compare_status = excluded.compare_status,
    ahead_by = excluded.ahead_by,
    behind_by = excluded.behind_by,
    updated_at = datetime('now')
`);

const getAllProjects = db.prepare('SELECT * FROM projects ORDER BY last_commit_date DESC');
const getProjectById = db.prepare('SELECT * FROM projects WHERE id = ?');
const getProjectByName = db.prepare('SELECT * FROM projects WHERE name = ?');
const deleteProjectByName = db.prepare('DELETE FROM projects WHERE name = ?');

const insertAnalysis = db.prepare(`
  INSERT INTO analysis (project_id, question, answer, context_summary)
  VALUES (?, ?, ?, ?)
`);

const getAnalysisByProjectId = db.prepare(`
  SELECT * FROM analysis WHERE project_id = ? ORDER BY created_at ASC
`);

export {
  db,
  upsertProject,
  getAllProjects,
  getProjectById,
  getProjectByName,
  deleteProjectByName,
  insertAnalysis,
  getAnalysisByProjectId,
};
