CREATE TABLE email_deliveries (
 id TEXT PRIMARY KEY,
 fingerprint TEXT NOT NULL UNIQUE,
 recipient TEXT NOT NULL,
 status TEXT NOT NULL,
 provider_id TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
