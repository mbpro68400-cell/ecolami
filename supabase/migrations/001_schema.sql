-- ============================================================
-- EcoLami — Schéma Supabase Complet
-- Migration : 001_schema.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Enums ─────────────────────────────────────────────────
CREATE TYPE user_role      AS ENUM ('parent','teacher','admin');
CREATE TYPE plan_tier      AS ENUM ('free','famille','famille_plus','ecole');
CREATE TYPE sub_status     AS ENUM ('trialing','active','past_due','canceled');
CREATE TYPE school_level   AS ENUM ('cp','ce1','ce2','cm1','cm2','6eme','5eme','4eme','3eme','2nde','1ere','terminale');
CREATE TYPE neuro_profile  AS ENUM ('normal','dys','tdah','hp','multi');
CREATE TYPE session_mode   AS ENUM ('tutor','scan','recitation','dictee','devoir');
CREATE TYPE hw_status      AS ENUM ('pending','in_progress','review','done');

-- ─── profiles ──────────────────────────────────────────────
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clerk_id        TEXT UNIQUE,
  email           TEXT UNIQUE NOT NULL,
  full_name       TEXT NOT NULL DEFAULT '',
  avatar_url      TEXT,
  role            user_role NOT NULL DEFAULT 'parent',
  plan            plan_tier NOT NULL DEFAULT 'free',
  timezone        TEXT DEFAULT 'Europe/Paris',
  onboarding_done BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── children ──────────────────────────────────────────────
CREATE TABLE children (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  age              INT NOT NULL CHECK (age BETWEEN 5 AND 19),
  grade            school_level NOT NULL,
  avatar           TEXT DEFAULT '🧒',
  neuro_profile    neuro_profile DEFAULT 'normal',
  preferred_tutor  TEXT DEFAULT 'sophie',
  parental_lock    BOOLEAN DEFAULT FALSE,
  allowed_subjects TEXT[] DEFAULT '{}',
  total_xp         INT DEFAULT 0,
  current_streak   INT DEFAULT 0,
  longest_streak   INT DEFAULT 0,
  total_sessions   INT DEFAULT 0,
  last_session_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── sessions ──────────────────────────────────────────────
CREATE TABLE sessions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id         UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  parent_id        UUID NOT NULL REFERENCES profiles(id),
  mode             session_mode NOT NULL,
  subject          TEXT NOT NULL,
  topic            TEXT,
  status           TEXT DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  exercise_text    TEXT,
  scan_image_url   TEXT,
  difficulty       INT DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  hints_given      INT DEFAULT 0,
  msg_count        INT DEFAULT 0,
  correct_count    INT DEFAULT 0,
  partial_count    INT DEFAULT 0,
  incorrect_count  INT DEFAULT 0,
  accuracy         FLOAT,
  xp_earned        INT DEFAULT 0,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  duration_sec     INT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── messages ──────────────────────────────────────────────
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content     TEXT NOT NULL,
  hint_level  INT DEFAULT 0,
  quality     TEXT,
  tokens_in   INT,
  tokens_out  INT,
  model       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── progress ──────────────────────────────────────────────
CREATE TABLE progress (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id       UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  subject        TEXT NOT NULL,
  topic          TEXT NOT NULL,
  mastery_level  INT DEFAULT 0 CHECK (mastery_level BETWEEN 0 AND 100),
  mastery_label  TEXT GENERATED ALWAYS AS (
    CASE
      WHEN mastery_level >= 90 THEN 'mastered'
      WHEN mastery_level >= 70 THEN 'acquired'
      WHEN mastery_level >= 40 THEN 'fragile'
      WHEN mastery_level > 0   THEN 'struggling'
      ELSE 'not_started'
    END
  ) STORED,
  trend          TEXT DEFAULT 'stable' CHECK (trend IN ('up','stable','down')),
  attempts       INT DEFAULT 0,
  correct        INT DEFAULT 0,
  last_practiced TIMESTAMPTZ,
  next_review    TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, subject, topic)
);

-- ─── homework ──────────────────────────────────────────────
CREATE TABLE homework (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id       UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  subject        TEXT NOT NULL,
  description    TEXT,
  due_date       TIMESTAMPTZ,
  photo_url      TEXT,
  status         hw_status DEFAULT 'pending',
  subtasks       JSONB DEFAULT '[]',
  completion_pct FLOAT DEFAULT 0,
  time_spent_min INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── session_reports ───────────────────────────────────────
CREATE TABLE session_reports (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id          UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  child_id            UUID NOT NULL REFERENCES children(id),
  summary_json        JSONB NOT NULL DEFAULT '{}',
  parent_summary      TEXT,
  xp_earned           INT DEFAULT 0,
  difficulty_start    INT,
  difficulty_end      INT,
  parent_notified     BOOLEAN DEFAULT FALSE,
  notified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── subscriptions ─────────────────────────────────────────
CREATE TABLE subscriptions (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id             UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  plan                   plan_tier NOT NULL DEFAULT 'free',
  status                 sub_status NOT NULL DEFAULT 'trialing',
  trial_end              TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  current_period_start   TIMESTAMPTZ DEFAULT NOW(),
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ─── daily_activity ────────────────────────────────────────
CREATE TABLE daily_activity (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id  UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  day       DATE NOT NULL DEFAULT CURRENT_DATE,
  sessions  INT DEFAULT 0,
  time_min  INT DEFAULT 0,
  xp        INT DEFAULT 0,
  subjects  TEXT[] DEFAULT '{}',
  UNIQUE(child_id, day)
);

-- ─── alerts ────────────────────────────────────────────────
CREATE TABLE alerts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  child_id   UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  metadata   JSONB DEFAULT '{}',
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── badges ────────────────────────────────────────────────
CREATE TABLE badges (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  xp_reward   INT DEFAULT 50
);

CREATE TABLE child_badges (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id   UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  badge_id   TEXT NOT NULL REFERENCES badges(id),
  earned_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, badge_id)
);

-- ─── Indexes ───────────────────────────────────────────────
CREATE INDEX idx_profiles_clerk     ON profiles(clerk_id);
CREATE INDEX idx_children_parent    ON children(parent_id);
CREATE INDEX idx_sessions_child     ON sessions(child_id);
CREATE INDEX idx_sessions_parent    ON sessions(parent_id, started_at DESC);
CREATE INDEX idx_sessions_active    ON sessions(child_id, status) WHERE status = 'active';
CREATE INDEX idx_sessions_week      ON sessions(child_id, started_at);
CREATE INDEX idx_messages_session   ON messages(session_id, created_at);
CREATE INDEX idx_progress_child     ON progress(child_id, subject);
CREATE INDEX idx_progress_review    ON progress(next_review) WHERE next_review IS NOT NULL;
CREATE INDEX idx_homework_child     ON homework(child_id, status);
CREATE INDEX idx_daily_child        ON daily_activity(child_id, day DESC);
CREATE INDEX idx_alerts_parent      ON alerts(parent_id, is_read, created_at DESC);

-- ─── RLS ───────────────────────────────────────────────────
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE children        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress        ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework        ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_badges    ENABLE ROW LEVEL SECURITY;

-- Helper: IDs des enfants du parent connecté
CREATE OR REPLACE FUNCTION my_children_ids() RETURNS SETOF UUID
  LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT id FROM children WHERE parent_id = auth.uid()
$$;

CREATE POLICY "profiles_own"        ON profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "children_parent"     ON children FOR ALL USING (parent_id = auth.uid());
CREATE POLICY "sessions_parent"     ON sessions FOR ALL USING (parent_id = auth.uid());
CREATE POLICY "messages_parent"     ON messages FOR ALL USING (session_id IN (SELECT id FROM sessions WHERE parent_id = auth.uid()));
CREATE POLICY "progress_parent"     ON progress FOR ALL USING (child_id IN (SELECT my_children_ids()));
CREATE POLICY "homework_parent"     ON homework FOR ALL USING (child_id IN (SELECT my_children_ids()));
CREATE POLICY "reports_parent"      ON session_reports FOR SELECT USING (child_id IN (SELECT my_children_ids()));
CREATE POLICY "subs_own"            ON subscriptions FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "daily_parent"        ON daily_activity FOR ALL USING (child_id IN (SELECT my_children_ids()));
CREATE POLICY "alerts_parent"       ON alerts FOR ALL USING (parent_id = auth.uid());
CREATE POLICY "child_badges_parent" ON child_badges FOR SELECT USING (child_id IN (SELECT my_children_ids()));

-- ─── Triggers ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_upd  BEFORE UPDATE ON profiles       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_children_upd  BEFORE UPDATE ON children       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_homework_upd  BEFORE UPDATE ON homework       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_subs_upd      BEFORE UPDATE ON subscriptions  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_progress_upd  BEFORE UPDATE ON progress       FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- On session completed → update child stats + daily activity + alert parent
CREATE OR REPLACE FUNCTION on_session_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'active' THEN
    NEW.ended_at = NOW();
    NEW.duration_sec = EXTRACT(EPOCH FROM (NOW() - NEW.started_at))::INT;
    NEW.accuracy = CASE
      WHEN (NEW.correct_count + NEW.partial_count + NEW.incorrect_count) > 0
      THEN ROUND(NEW.correct_count::NUMERIC / (NEW.correct_count + NEW.partial_count + NEW.incorrect_count) * 100, 1)
      ELSE NULL
    END;
    UPDATE children SET
      total_sessions = total_sessions + 1,
      total_xp = total_xp + COALESCE(NEW.xp_earned, 0),
      last_session_at = NOW()
    WHERE id = NEW.child_id;
    INSERT INTO daily_activity (child_id, day, sessions, time_min, xp, subjects)
    VALUES (NEW.child_id, CURRENT_DATE, 1, COALESCE(NEW.duration_sec,0)/60, COALESCE(NEW.xp_earned,0), ARRAY[NEW.subject])
    ON CONFLICT (child_id, day) DO UPDATE SET
      sessions = daily_activity.sessions + 1,
      time_min = daily_activity.time_min + EXCLUDED.time_min,
      xp = daily_activity.xp + EXCLUDED.xp,
      subjects = ARRAY(SELECT DISTINCT unnest(daily_activity.subjects || EXCLUDED.subjects));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_session_completed
  BEFORE UPDATE ON sessions FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status = 'active')
  EXECUTE FUNCTION on_session_completed();

-- Spaced repetition auto-schedule
CREATE OR REPLACE FUNCTION schedule_review()
RETURNS TRIGGER AS $$
BEGIN
  NEW.next_review = CASE
    WHEN NEW.mastery_level >= 90 THEN NOW() + INTERVAL '14 days'
    WHEN NEW.mastery_level >= 70 THEN NOW() + INTERVAL '7 days'
    WHEN NEW.mastery_level >= 40 THEN NOW() + INTERVAL '3 days'
    WHEN NEW.mastery_level > 0   THEN NOW() + INTERVAL '1 day'
    ELSE NULL
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_review
  BEFORE INSERT OR UPDATE OF mastery_level ON progress FOR EACH ROW
  EXECUTE FUNCTION schedule_review();

-- ─── RPC Helpers ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_weekly_session_count(p_child_id UUID)
RETURNS INT LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT count(*)::INT FROM sessions
  WHERE child_id = p_child_id
    AND started_at >= date_trunc('week', NOW())
    AND status IN ('active','completed')
$$;

-- ─── Seed badges ───────────────────────────────────────────
INSERT INTO badges (id, name, description, icon, xp_reward) VALUES
  ('first_session',  'Premiers pas',    'Première session terminée',      '🌱', 50),
  ('streak_3',       'Régulier',        '3 jours de suite',               '🔥', 75),
  ('streak_7',       'Flamme vive',     '7 jours de suite',               '🔥', 150),
  ('streak_30',      'Inarrêtable',     '30 jours de suite',              '🏆', 500),
  ('math_master',    'Mathématicien',   '10 exercices maths résolus',     '🔢', 100),
  ('french_master',  'Plume d''or',     '10 sessions français',           '📖', 100),
  ('no_hints_5',     'Autonome',        '5 sessions sans indice',         '⭐', 200),
  ('scan_first',     'Photographe',     'Premier scan de devoir',         '📸', 75),
  ('perfect_dictee', 'Zéro faute',      'Dictée parfaite',                '✏️', 200),
  ('explorer',       'Explorateur',     'Essayer 3 matières différentes', '🌍', 100);
