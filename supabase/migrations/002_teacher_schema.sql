-- ============================================================
-- EcoLami — Schéma Enseignants (RGPD)
-- Migration : 002_teacher_schema.sql
-- Pseudonymisation totale : jamais le vrai nom côté enseignant
-- ============================================================

-- Génère un pseudo déterministe : "Élève-XXXX"
CREATE OR REPLACE FUNCTION generate_child_pseudo(p_child_id UUID, p_teacher_id UUID)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT 'Élève-' || UPPER(SUBSTRING(encode(digest(p_child_id::TEXT || ':' || p_teacher_id::TEXT, 'sha256'), 'hex') FROM 1 FOR 4))
$$;

-- ─── teacher_accounts ──────────────────────────────────────
CREATE TABLE teacher_accounts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id   UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  email        TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  school_name  TEXT NOT NULL DEFAULT '',
  subject      TEXT,
  grade_levels school_level[] DEFAULT '{}',
  verified_at  TIMESTAMPTZ,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── teacher_invitations ───────────────────────────────────
CREATE TABLE teacher_invitations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  teacher_id        UUID REFERENCES teacher_accounts(id),
  teacher_email     TEXT NOT NULL,
  child_id          UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  consent_scope     TEXT[] NOT NULL DEFAULT '{}',
  consent_granted_at TIMESTAMPTZ,
  accepted_at       TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,
  revoke_reason     TEXT,
  invite_token      TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  token_expires_at  TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent_id, child_id, teacher_email)
);

-- ─── teacher_recommendations ───────────────────────────────
CREATE TABLE teacher_recommendations (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id         UUID NOT NULL REFERENCES teacher_accounts(id) ON DELETE CASCADE,
  invitation_id      UUID NOT NULL REFERENCES teacher_invitations(id) ON DELETE CASCADE,
  child_pseudo_id    TEXT NOT NULL,
  subject            TEXT NOT NULL,
  notion             TEXT NOT NULL,
  recommendation_text TEXT NOT NULL,
  recommendation_type TEXT DEFAULT 'method' CHECK (recommendation_type IN ('exercise','method','alert')),
  seen_by_parent_at  TIMESTAMPTZ,
  seen_by_child_at   TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ─── teacher_class_announcements ───────────────────────────
CREATE TABLE teacher_class_announcements (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id   UUID NOT NULL REFERENCES teacher_accounts(id) ON DELETE CASCADE,
  message      TEXT NOT NULL CHECK (length(message) BETWEEN 5 AND 1000),
  target_grade school_level,
  subject      TEXT,
  expires_at   TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── weekly_teacher_reports ────────────────────────────────
CREATE TABLE weekly_teacher_reports (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitation_id           UUID NOT NULL REFERENCES teacher_invitations(id) ON DELETE CASCADE,
  child_pseudo_id         TEXT NOT NULL,
  week_start              DATE NOT NULL,
  session_count           INT DEFAULT 0,
  total_time_min          INT DEFAULT 0,
  avg_comprehension_score FLOAT,
  weak_notions            TEXT[] DEFAULT '{}',
  strong_notions          TEXT[] DEFAULT '{}',
  persistent_errors       TEXT[] DEFAULT '{}',
  trend                   TEXT DEFAULT 'stable' CHECK (trend IN ('improving','stable','declining')),
  weeks_in_red            INT DEFAULT 0,
  generated_at            TIMESTAMPTZ DEFAULT NOW(),
  emailed_at              TIMESTAMPTZ,
  UNIQUE(invitation_id, week_start)
);

-- ─── Indexes ───────────────────────────────────────────────
CREATE INDEX idx_teacher_accounts_email ON teacher_accounts(email);
CREATE INDEX idx_invitations_parent     ON teacher_invitations(parent_id);
CREATE INDEX idx_invitations_teacher    ON teacher_invitations(teacher_id, status);
CREATE INDEX idx_invitations_token      ON teacher_invitations(invite_token);
CREATE INDEX idx_invitations_active     ON teacher_invitations(teacher_id) WHERE status = 'accepted' AND revoked_at IS NULL;
CREATE INDEX idx_reco_teacher           ON teacher_recommendations(teacher_id);
CREATE INDEX idx_reco_unseen            ON teacher_recommendations(invitation_id) WHERE seen_by_parent_at IS NULL;
CREATE INDEX idx_weekly_reports         ON weekly_teacher_reports(invitation_id, week_start DESC);

-- ─── RLS ───────────────────────────────────────────────────
ALTER TABLE teacher_accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_invitations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_recommendations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_class_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_teacher_reports      ENABLE ROW LEVEL SECURITY;

-- Helper: vérifier consentement actif
CREATE OR REPLACE FUNCTION has_active_consent(p_invitation_id UUID) RETURNS BOOLEAN
  LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM teacher_invitations
    WHERE id = p_invitation_id AND status = 'accepted'
      AND consent_granted_at IS NOT NULL AND revoked_at IS NULL
  )
$$;

CREATE POLICY "teacher_own"          ON teacher_accounts FOR ALL USING (profile_id = auth.uid());
CREATE POLICY "invitations_parent"   ON teacher_invitations FOR ALL USING (parent_id = auth.uid());
CREATE POLICY "invitations_teacher"  ON teacher_invitations FOR SELECT USING (
  teacher_id IN (SELECT id FROM teacher_accounts WHERE profile_id = auth.uid())
  AND status = 'accepted' AND revoked_at IS NULL
);
CREATE POLICY "reco_teacher_read"    ON teacher_recommendations FOR SELECT USING (
  teacher_id IN (SELECT id FROM teacher_accounts WHERE profile_id = auth.uid())
);
CREATE POLICY "reco_teacher_write"   ON teacher_recommendations FOR INSERT WITH CHECK (
  teacher_id IN (SELECT id FROM teacher_accounts WHERE profile_id = auth.uid())
  AND has_active_consent(invitation_id)
);
CREATE POLICY "reco_parent_read"     ON teacher_recommendations FOR SELECT USING (
  invitation_id IN (SELECT id FROM teacher_invitations WHERE parent_id = auth.uid())
);
CREATE POLICY "reco_parent_update"   ON teacher_recommendations FOR UPDATE USING (
  invitation_id IN (SELECT id FROM teacher_invitations WHERE parent_id = auth.uid())
);
CREATE POLICY "announce_teacher"     ON teacher_class_announcements FOR ALL USING (
  teacher_id IN (SELECT id FROM teacher_accounts WHERE profile_id = auth.uid())
);
CREATE POLICY "announce_parent"      ON teacher_class_announcements FOR SELECT USING (
  teacher_id IN (
    SELECT ti.teacher_id FROM teacher_invitations ti
    WHERE ti.parent_id = auth.uid() AND ti.status = 'accepted' AND ti.revoked_at IS NULL
  ) AND (expires_at IS NULL OR expires_at > NOW())
);
CREATE POLICY "reports_teacher"      ON weekly_teacher_reports FOR SELECT USING (
  invitation_id IN (
    SELECT id FROM teacher_invitations
    WHERE teacher_id IN (SELECT id FROM teacher_accounts WHERE profile_id = auth.uid())
      AND status = 'accepted' AND revoked_at IS NULL
  )
);
CREATE POLICY "reports_parent"       ON weekly_teacher_reports FOR SELECT USING (
  invitation_id IN (SELECT id FROM teacher_invitations WHERE parent_id = auth.uid())
);

-- ─── Trigger révocation RGPD ───────────────────────────────
CREATE OR REPLACE FUNCTION on_invitation_revoked()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'revoked' AND OLD.status = 'accepted' THEN
    NEW.revoked_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_invitation_revoked
  BEFORE UPDATE ON teacher_invitations FOR EACH ROW
  WHEN (NEW.status = 'revoked' AND OLD.status = 'accepted')
  EXECUTE FUNCTION on_invitation_revoked();
