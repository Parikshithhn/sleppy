CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  ign TEXT NOT NULL,
  bgmi_uid TEXT NOT NULL UNIQUE,
  whatsapp TEXT NOT NULL UNIQUE,
  role TEXT DEFAULT 'PLAYER',
  roster_status TEXT DEFAULT 'ACTIVE',
  active BOOLEAN DEFAULT TRUE,
  join_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idps (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  match_date DATE NOT NULL,
  match_time TIME NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'SCHEDULED',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS idp_attendance (
  id SERIAL PRIMARY KEY,
  idp_id INTEGER NOT NULL REFERENCES idps(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'NO RESPONSE',
  joined_at TIMESTAMPTZ,
  UNIQUE(idp_id, player_id)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL REFERENCES players(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  replacement_player_id INTEGER NOT NULL REFERENCES players(id),
  status TEXT DEFAULT 'PENDING',
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  revoked_by TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS substitution_assignments (
  id SERIAL PRIMARY KEY,
  leave_id INTEGER NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
  original_player_id INTEGER NOT NULL REFERENCES players(id),
  substitute_player_id INTEGER NOT NULL REFERENCES players(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  match_date DATE,
  match_type TEXT DEFAULT 'MATCH',
  map TEXT,
  screenshot_url TEXT,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_results (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_placement INTEGER NOT NULL CHECK(team_placement BETWEEN 1 AND 99),
  total_team_finishes INTEGER DEFAULT 0,
  placement_points INTEGER DEFAULT 0,
  finish_points INTEGER DEFAULT 0,
  total_points INTEGER DEFAULT 0,
  confirmed BOOLEAN DEFAULT FALSE,
  extracted_text JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_match_stats (
  id SERIAL PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id),
  finishes INTEGER DEFAULT 0,
  finish_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

CREATE TABLE IF NOT EXISTS official_points_tables (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  is_current BOOLEAN DEFAULT TRUE,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrims (
  id SERIAL PRIMARY KEY,
  opponent TEXT,
  scrim_date DATE NOT NULL,
  scrim_time TIME NOT NULL,
  maps TEXT,
  room_id TEXT,
  password TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournaments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  schedule TEXT,
  results TEXT,
  points_tracking TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  send_at TIMESTAMPTZ NOT NULL,
  audience TEXT DEFAULT 'TEAM',
  player_ids INTEGER[],
  status TEXT DEFAULT 'SCHEDULED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  audience TEXT DEFAULT 'TEAM',
  scheduled_at TIMESTAMPTZ,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT,
  actor_type TEXT,
  action TEXT NOT NULL,
  object_type TEXT,
  object_id TEXT,
  old_value JSONB,
  new_value JSONB,
  status TEXT DEFAULT 'SUCCESS',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings(key,value) VALUES
('leave_approval_mode','MANUAL')
ON CONFLICT(key) DO NOTHING;
