-- ============================================================================
-- PRL-OCA 3D ONLINE - Migración Inicial Cloudflare D1 (SQLite)
-- ============================================================================

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  type TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_indices_json TEXT NOT NULL,
  explanation_json TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  time_seconds INTEGER NOT NULL DEFAULT 30,
  collection TEXT DEFAULT 'General',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_active ON questions(active);

CREATE TABLE IF NOT EXISTS match_history (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  room_name TEXT NOT NULL,
  finished_at INTEGER NOT NULL,
  mode TEXT NOT NULL,
  winner_team_name TEXT NOT NULL,
  winner_color TEXT NOT NULL,
  winner_score INTEGER NOT NULL,
  total_turns INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  overall_accuracy INTEGER NOT NULL,
  teams_summary_json TEXT NOT NULL,
  mastered_categories_json TEXT NOT NULL,
  reinforce_categories_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_match_history_finished_at ON match_history(finished_at DESC);
