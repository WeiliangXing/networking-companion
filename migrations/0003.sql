CREATE UNIQUE INDEX IF NOT EXISTS one_send_per_guest ON drafts(guest_id) WHERE status IN ('sending','sent','unknown');
