CREATE TABLE IF NOT EXISTS meetings (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL,
 ended_at TEXT, status TEXT NOT NULL DEFAULT 'listening', analysis TEXT NOT NULL DEFAULT '', analyzed_seq INTEGER NOT NULL DEFAULT -1
);
CREATE TABLE IF NOT EXISTS meeting_segments (
 meeting_id TEXT NOT NULL REFERENCES meetings(id), item_id TEXT NOT NULL, seq INTEGER NOT NULL,
 text TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(meeting_id,item_id)
);
CREATE INDEX IF NOT EXISTS meeting_segments_order ON meeting_segments(meeting_id,seq);
