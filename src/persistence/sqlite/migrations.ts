import type { LocalMigration } from '../localDatabase';

const createSchema = `
CREATE TABLE IF NOT EXISTS user_profile (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  locale TEXT NOT NULL,
  pilgrim_class TEXT NOT NULL,
  travel_mode TEXT NOT NULL,
  budget_mode TEXT NOT NULL,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY NOT NULL,
  notification_tolerance TEXT NOT NULL,
  allow_location_tracking INTEGER NOT NULL,
  allow_community_features INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS selected_campaign (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  route_slug TEXT NOT NULL,
  travel_mode TEXT NOT NULL,
  recommended_days INTEGER NOT NULL,
  stage_slugs_json TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS active_journey (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  route_slug TEXT NOT NULL,
  active_stage_slug TEXT,
  status TEXT NOT NULL,
  started_at_iso TEXT,
  updated_at_iso TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stage_progress (
  journey_id TEXT NOT NULL,
  stage_slug TEXT NOT NULL,
  state TEXT NOT NULL,
  completed_at_iso TEXT,
  evidence_json TEXT,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (journey_id, stage_slug),
  FOREIGN KEY (journey_id) REFERENCES active_journey(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tracking_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  journey_id TEXT NOT NULL,
  stage_slug TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at_iso TEXT NOT NULL,
  ended_at_iso TEXT,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (journey_id) REFERENCES active_journey(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tracking_samples (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  recorded_at_iso TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy_meters REAL,
  evidence_json TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES tracking_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS decision_cycles (
  id TEXT PRIMARY KEY NOT NULL,
  trigger TEXT NOT NULL,
  started_at_iso TEXT NOT NULL,
  completed_at_iso TEXT,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decision_recommendations (
  id TEXT PRIMARY KEY NOT NULL,
  cycle_id TEXT,
  journey_id TEXT,
  type TEXT NOT NULL,
  priority TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  shown_at_iso TEXT,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (cycle_id) REFERENCES decision_cycles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_history (
  id TEXT PRIMARY KEY NOT NULL,
  recommendation_id TEXT NOT NULL,
  shown_at_iso TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quest_state (
  id TEXT PRIMARY KEY NOT NULL,
  journey_id TEXT NOT NULL,
  quest_template_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress REAL NOT NULL,
  updated_at_iso TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (journey_id) REFERENCES active_journey(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS achievement_state (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at_iso TEXT,
  progress REAL NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collectible_state (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  collectible_id TEXT NOT NULL,
  count INTEGER NOT NULL,
  updated_at_iso TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user_profile(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY NOT NULL,
  journey_id TEXT NOT NULL,
  stage_slug TEXT NOT NULL,
  date_iso TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (journey_id) REFERENCES active_journey(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expense_entries (
  id TEXT PRIMARY KEY NOT NULL,
  journey_id TEXT NOT NULL,
  stage_slug TEXT,
  category TEXT NOT NULL,
  amount_eur REAL NOT NULL,
  spent_at_iso TEXT NOT NULL,
  note TEXT,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (journey_id) REFERENCES active_journey(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS saved_places (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  place_type TEXT NOT NULL,
  saved_at_iso TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS community_reports_local (
  id TEXT PRIMARY KEY NOT NULL,
  journey_id TEXT,
  stage_slug TEXT,
  report_type TEXT NOT NULL,
  created_at_iso TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at_iso TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_active_journey_user ON active_journey(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_samples_session ON tracking_samples(session_id, recorded_at_iso);
CREATE INDEX IF NOT EXISTS idx_decision_recommendations_journey ON decision_recommendations(journey_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_journey ON journal_entries(journey_id, date_iso);
CREATE INDEX IF NOT EXISTS idx_expense_entries_journey ON expense_entries(journey_id, spent_at_iso);
`;

export const localMigrations: LocalMigration[] = [
  {
    version: 1,
    name: 'create-local-user-and-journey-state',
    up: async (database) => {
      await database.execute(createSchema);
    },
  },
];
