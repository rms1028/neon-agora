-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  네온 아고라 — 통합 스키마                                          ║
-- ║  실행 순서: 이 파일 하나만 실행하면 됩니다                           ║
-- ╚══════════════════════════════════════════════════════════════════════╝


-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  01. Auth & Profiles                                                ║
-- ║  의존성: 없음 (최초 실행)                                           ║
-- ╚══════════════════════════════════════════════════════════════════════╝


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. profiles
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp         INTEGER NOT NULL DEFAULT 0,
  badge      TEXT    NOT NULL DEFAULT '네온 뉴비',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- v4: custom_title
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_title TEXT DEFAULT NULL;

-- v7: season / streak
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS season_xp INT NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_days INT NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_date DATE;

-- v9: display_name / avatar / bio
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT CHECK (display_name IS NULL OR char_length(display_name) <= 20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT CHECK (bio IS NULL OR char_length(bio) <= 200);

-- gamification-v2: daily XP / level
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_xp_earned INT NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_xp_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS level INT NOT NULL DEFAULT 1;

-- v10: admin / ban
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;

-- 기존 유저 level 초기화 (sqrt 공식)
UPDATE profiles SET level = GREATEST(1, floor(sqrt(GREATEST(0, xp)::numeric / 100)) + 1)
WHERE level = 1 AND xp > 0;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;

CREATE POLICY "profiles_select"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_insert"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. follows
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS follows (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id <> following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can see follows" ON follows;
DROP POLICY IF EXISTS "Users can follow" ON follows;
DROP POLICY IF EXISTS "Users can unfollow" ON follows;

CREATE POLICY "Anyone can see follows"
  ON follows FOR SELECT
  USING (true);

CREATE POLICY "Users can follow"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. 인덱스
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Realtime
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- profiles, follows → Supabase Dashboard > Database > Replication에서 활성화



-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  02. Debates & Content                                              ║
-- ║  의존성: 01_auth_and_profiles.sql                                   ║
-- ╚══════════════════════════════════════════════════════════════════════╝


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. threads
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT    NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  content     TEXT    NOT NULL DEFAULT '' CHECK (char_length(content) <= 500),
  tag         TEXT,
  pro_count   INTEGER NOT NULL DEFAULT 0,
  con_count   INTEGER NOT NULL DEFAULT 0,
  created_by  UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  ai_summary  JSONB,
  ai_verdict  TEXT,
  ai_auto_summary JSONB DEFAULT NULL,
  is_closed   BOOLEAN NOT NULL DEFAULT false,
  closed_at   TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ
);

-- v5: AI prediction
ALTER TABLE threads ADD COLUMN IF NOT EXISTS ai_prediction JSONB DEFAULT NULL;
-- v6: template
ALTER TABLE threads ADD COLUMN IF NOT EXISTS template TEXT NOT NULL DEFAULT 'free';
-- v17: auto-close timer
ALTER TABLE threads ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threads_select" ON threads;
DROP POLICY IF EXISTS "threads_insert" ON threads;
DROP POLICY IF EXISTS "threads_update" ON threads;
DROP POLICY IF EXISTS "threads_delete" ON threads;

CREATE POLICY "threads_select" ON threads FOR SELECT USING (true);
CREATE POLICY "threads_insert" ON threads FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "threads_update" ON threads FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "threads_delete" ON threads FOR DELETE USING (auth.uid() = created_by);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. thread_votes
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS thread_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type  TEXT NOT NULL CHECK (vote_type IN ('pro', 'con')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (thread_id, user_id)
);

ALTER TABLE thread_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "thread_votes_select" ON thread_votes;
DROP POLICY IF EXISTS "thread_votes_insert" ON thread_votes;
DROP POLICY IF EXISTS "thread_votes_update" ON thread_votes;
DROP POLICY IF EXISTS "thread_votes_delete" ON thread_votes;

CREATE POLICY "thread_votes_select" ON thread_votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "thread_votes_insert" ON thread_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "thread_votes_update" ON thread_votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "thread_votes_delete" ON thread_votes FOR DELETE USING (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. comments
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  side       TEXT NOT NULL CHECK (side IN ('pro', 'con')),
  created_at TIMESTAMPTZ DEFAULT now(),
  parent_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- v4: pinned comments
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select" ON comments;
DROP POLICY IF EXISTS "comments_insert" ON comments;
DROP POLICY IF EXISTS "comments_update" ON comments;
DROP POLICY IF EXISTS "comments_delete" ON comments;
DROP POLICY IF EXISTS "comments_pin_by_thread_creator" ON comments;

CREATE POLICY "comments_select" ON comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "comments_pin_by_thread_creator" ON comments FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM threads WHERE threads.id = comments.thread_id AND threads.created_by = auth.uid()
  ));


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. comment_reactions
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS comment_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction   TEXT NOT NULL CHECK (reaction IN ('like', 'dislike', 'fire')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_reactions_select" ON comment_reactions;
DROP POLICY IF EXISTS "comment_reactions_insert" ON comment_reactions;
DROP POLICY IF EXISTS "comment_reactions_delete" ON comment_reactions;

CREATE POLICY "comment_reactions_select" ON comment_reactions FOR SELECT USING (true);
CREATE POLICY "comment_reactions_insert" ON comment_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comment_reactions_delete" ON comment_reactions FOR DELETE USING (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. bookmarks
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS bookmarks (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id  UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, thread_id)
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can insert own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON bookmarks;

CREATE POLICY "Users can view own bookmarks" ON bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bookmarks" ON bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON bookmarks FOR DELETE USING (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. tag_subscriptions
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS tag_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tag)
);

ALTER TABLE tag_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tag_subscriptions_select" ON tag_subscriptions;
DROP POLICY IF EXISTS "tag_subscriptions_insert" ON tag_subscriptions;
DROP POLICY IF EXISTS "tag_subscriptions_delete" ON tag_subscriptions;

CREATE POLICY "tag_subscriptions_select" ON tag_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tag_subscriptions_insert" ON tag_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tag_subscriptions_delete" ON tag_subscriptions FOR DELETE USING (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. thread_mutes
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS thread_mutes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id   UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, thread_id)
);

ALTER TABLE thread_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own mutes" ON thread_mutes;
DROP POLICY IF EXISTS "Users can insert own mutes" ON thread_mutes;
DROP POLICY IF EXISTS "Users can delete own mutes" ON thread_mutes;

CREATE POLICY "Users can view own mutes" ON thread_mutes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mutes" ON thread_mutes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own mutes" ON thread_mutes FOR DELETE USING (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 8. vote_logs
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS vote_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL CHECK (action IN ('new_pro','new_con','switch_to_pro','switch_to_con','remove_pro','remove_con')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vote_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vote_logs_select" ON vote_logs;
DROP POLICY IF EXISTS "vote_logs_insert" ON vote_logs;

CREATE POLICY "vote_logs_select" ON vote_logs FOR SELECT USING (true);
CREATE POLICY "vote_logs_insert" ON vote_logs FOR INSERT WITH CHECK (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 9. fact_checks
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS fact_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE UNIQUE,
  verdict TEXT NOT NULL CHECK (verdict IN ('확인됨', '의심', '거짓', '판단불가')),
  explanation TEXT NOT NULL,
  checked_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fact_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fact_checks_select" ON fact_checks;
DROP POLICY IF EXISTS "fact_checks_insert" ON fact_checks;

CREATE POLICY "fact_checks_select" ON fact_checks FOR SELECT USING (true);
CREATE POLICY "fact_checks_insert" ON fact_checks FOR INSERT WITH CHECK (auth.uid() = checked_by);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 10. live_sessions / live_messages
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE UNIQUE,
  started_by UUID NOT NULL REFERENCES auth.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INT NOT NULL CHECK (duration_minutes IN (5, 10, 15)),
  is_active BOOLEAN NOT NULL DEFAULT true,
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS live_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL CHECK (char_length(content) <= 300),
  side TEXT NOT NULL CHECK (side IN ('pro', 'con')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_sessions_select" ON live_sessions;
DROP POLICY IF EXISTS "live_sessions_insert" ON live_sessions;
DROP POLICY IF EXISTS "live_sessions_update" ON live_sessions;

CREATE POLICY "live_sessions_select" ON live_sessions FOR SELECT USING (true);
CREATE POLICY "live_sessions_insert" ON live_sessions FOR INSERT WITH CHECK (auth.uid() = started_by);
CREATE POLICY "live_sessions_update" ON live_sessions FOR UPDATE USING (auth.uid() = started_by);

DROP POLICY IF EXISTS "live_messages_select" ON live_messages;
DROP POLICY IF EXISTS "live_messages_insert" ON live_messages;

CREATE POLICY "live_messages_select" ON live_messages FOR SELECT USING (true);
CREATE POLICY "live_messages_insert" ON live_messages FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 11. ai_debate_messages
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS ai_debate_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  user_side  TEXT NOT NULL CHECK (user_side IN ('pro','con')),
  user_message TEXT NOT NULL CHECK (char_length(user_message) <= 500),
  ai_message TEXT NOT NULL,
  turn_number INT NOT NULL CHECK (turn_number BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ai_debate_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_debate_messages_select" ON ai_debate_messages;
DROP POLICY IF EXISTS "ai_debate_messages_insert" ON ai_debate_messages;

CREATE POLICY "ai_debate_messages_select" ON ai_debate_messages FOR SELECT USING (true);
CREATE POLICY "ai_debate_messages_insert" ON ai_debate_messages FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 12. duels / duel_votes
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS duels (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id         UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  challenger_id     UUID NOT NULL,
  opponent_id       UUID NOT NULL,
  challenger_side   TEXT NOT NULL CHECK (challenger_side IN ('pro','con')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','active','completed')),
  challenger_argument TEXT,
  opponent_argument   TEXT,
  vote_challenger   INT NOT NULL DEFAULT 0,
  vote_opponent     INT NOT NULL DEFAULT 0,
  winner_id         UUID,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  CHECK (challenger_id <> opponent_id)
);

CREATE TABLE IF NOT EXISTS duel_votes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id   UUID NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL,
  voted_for UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(duel_id, user_id)
);

ALTER TABLE duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE duel_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duels_select" ON duels;
DROP POLICY IF EXISTS "duels_insert" ON duels;
DROP POLICY IF EXISTS "duels_update" ON duels;

CREATE POLICY "duels_select" ON duels FOR SELECT USING (true);
CREATE POLICY "duels_insert" ON duels FOR INSERT WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "duels_update" ON duels FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

DROP POLICY IF EXISTS "duel_votes_select" ON duel_votes;
DROP POLICY IF EXISTS "duel_votes_insert" ON duel_votes;

CREATE POLICY "duel_votes_select" ON duel_votes FOR SELECT USING (true);
CREATE POLICY "duel_votes_insert" ON duel_votes FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 13. thread_bets
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS thread_bets (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL,
  side      TEXT NOT NULL CHECK (side IN ('pro','con')),
  amount    INT NOT NULL CHECK (amount BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

ALTER TABLE thread_bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "thread_bets_select" ON thread_bets;
DROP POLICY IF EXISTS "thread_bets_insert" ON thread_bets;

CREATE POLICY "thread_bets_select" ON thread_bets FOR SELECT USING (true);
CREATE POLICY "thread_bets_insert" ON thread_bets FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 14. comment_polls / comment_poll_votes
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS comment_polls (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL UNIQUE REFERENCES comments(id) ON DELETE CASCADE,
  question   TEXT NOT NULL CHECK (char_length(question) <= 100),
  pro_count  INT NOT NULL DEFAULT 0,
  con_count  INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comment_poll_votes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   UUID NOT NULL REFERENCES comment_polls(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('pro','con')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

ALTER TABLE comment_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_polls_select" ON comment_polls;
DROP POLICY IF EXISTS "comment_polls_insert" ON comment_polls;

CREATE POLICY "comment_polls_select" ON comment_polls FOR SELECT USING (true);
CREATE POLICY "comment_polls_insert" ON comment_polls FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "comment_poll_votes_select" ON comment_poll_votes;
DROP POLICY IF EXISTS "comment_poll_votes_insert" ON comment_poll_votes;

CREATE POLICY "comment_poll_votes_select" ON comment_poll_votes FOR SELECT USING (true);
CREATE POLICY "comment_poll_votes_insert" ON comment_poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 15. comment_coaching / comment_sentiments
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS comment_coaching (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL UNIQUE REFERENCES comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  scores     JSONB NOT NULL,
  strengths  TEXT[] NOT NULL DEFAULT '{}',
  improvements TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comment_sentiments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL UNIQUE REFERENCES comments(id) ON DELETE CASCADE,
  tone       TEXT NOT NULL CHECK (tone IN ('공격적','논리적','감성적','중립적','유머')),
  confidence INT NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE comment_coaching ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_sentiments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comment_coaching_select" ON comment_coaching;
DROP POLICY IF EXISTS "comment_coaching_insert" ON comment_coaching;

CREATE POLICY "comment_coaching_select" ON comment_coaching FOR SELECT USING (true);
CREATE POLICY "comment_coaching_insert" ON comment_coaching FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "comment_sentiments_select" ON comment_sentiments;
DROP POLICY IF EXISTS "comment_sentiments_insert" ON comment_sentiments;

CREATE POLICY "comment_sentiments_select" ON comment_sentiments FOR SELECT USING (true);
CREATE POLICY "comment_sentiments_insert" ON comment_sentiments FOR INSERT WITH CHECK (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 16. tournaments
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'recruiting' CHECK (status IN ('recruiting','active','completed')),
  bracket_size INT NOT NULL CHECK (bracket_size IN (4, 8)),
  round_duration INT NOT NULL CHECK (round_duration IN (24, 48)),
  current_round INT NOT NULL DEFAULT 0,
  winner_thread_id UUID REFERENCES threads(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tournament_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  seed INT NOT NULL,
  eliminated_in INT,
  UNIQUE(tournament_id, thread_id),
  UNIQUE(tournament_id, seed)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INT NOT NULL,
  match_index INT NOT NULL,
  thread_a UUID REFERENCES threads(id),
  thread_b UUID REFERENCES threads(id),
  winner_thread UUID REFERENCES threads(id),
  votes_a INT DEFAULT 0,
  votes_b INT DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  UNIQUE(tournament_id, round, match_index)
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournaments_select" ON tournaments;
DROP POLICY IF EXISTS "tournaments_insert" ON tournaments;
DROP POLICY IF EXISTS "tournaments_update" ON tournaments;

CREATE POLICY "tournaments_select" ON tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_insert" ON tournaments FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "tournaments_update" ON tournaments FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "tournament_entries_select" ON tournament_entries;
DROP POLICY IF EXISTS "tournament_entries_insert" ON tournament_entries;

CREATE POLICY "tournament_entries_select" ON tournament_entries FOR SELECT USING (true);
CREATE POLICY "tournament_entries_insert" ON tournament_entries FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "tournament_matches_select" ON tournament_matches;
DROP POLICY IF EXISTS "tournament_matches_insert" ON tournament_matches;
DROP POLICY IF EXISTS "tournament_matches_update" ON tournament_matches;

CREATE POLICY "tournament_matches_select" ON tournament_matches FOR SELECT USING (true);
CREATE POLICY "tournament_matches_insert" ON tournament_matches FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tournament_matches_update" ON tournament_matches FOR UPDATE USING (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 17. CEDA sessions / messages / votes
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS ceda_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id             UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE UNIQUE,
  created_by            UUID NOT NULL REFERENCES auth.users(id),
  pro_user_id           UUID REFERENCES auth.users(id),
  con_user_id           UUID REFERENCES auth.users(id),
  status                TEXT NOT NULL DEFAULT 'recruiting'
                          CHECK (status IN ('recruiting','ready','active','completed','cancelled')),
  current_phase         TEXT NOT NULL DEFAULT 'waiting'
                          CHECK (current_phase IN (
                            'waiting','pro_constructive','cross_exam_by_con',
                            'con_constructive','cross_exam_by_pro',
                            'pro_rebuttal','con_rebuttal','finished'
                          )),
  constructive_duration INT NOT NULL DEFAULT 180,
  cross_exam_duration   INT NOT NULL DEFAULT 90,
  rebuttal_duration     INT NOT NULL DEFAULT 120,
  phase_started_at      TIMESTAMPTZ,
  phase_index           INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  winner_side           TEXT CHECK (winner_side IN ('pro','con','draw')),
  current_speaker_id    UUID REFERENCES auth.users(id),
  phase_summaries       JSONB NOT NULL DEFAULT '{}',
  CHECK (pro_user_id IS NULL OR con_user_id IS NULL OR pro_user_id <> con_user_id)
);

ALTER TABLE ceda_sessions DROP CONSTRAINT IF EXISTS ceda_sessions_constructive_duration_check;
ALTER TABLE ceda_sessions DROP CONSTRAINT IF EXISTS ceda_sessions_cross_exam_duration_check;
ALTER TABLE ceda_sessions DROP CONSTRAINT IF EXISTS ceda_sessions_rebuttal_duration_check;

CREATE TABLE IF NOT EXISTS ceda_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES ceda_sessions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  phase        TEXT NOT NULL CHECK (phase IN (
    'pro_constructive','cross_exam_by_con',
    'con_constructive','cross_exam_by_pro',
    'pro_rebuttal','con_rebuttal'
  )),
  msg_type     TEXT NOT NULL CHECK (msg_type IN ('argument','question','answer')),
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT content_length_check CHECK (
    CASE
      WHEN msg_type = 'answer' THEN char_length(content) <= 100
      WHEN msg_type = 'question' THEN char_length(content) <= 500
      ELSE char_length(content) <= 2000
    END
  )
);

CREATE TABLE IF NOT EXISTS ceda_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ceda_sessions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id),
  voted_for  TEXT NOT NULL CHECK (voted_for IN ('pro','con')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

ALTER TABLE ceda_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ceda_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ceda_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ceda_sessions_select" ON ceda_sessions;
DROP POLICY IF EXISTS "ceda_sessions_insert" ON ceda_sessions;
DROP POLICY IF EXISTS "ceda_sessions_update" ON ceda_sessions;

CREATE POLICY "ceda_sessions_select" ON ceda_sessions FOR SELECT USING (true);
CREATE POLICY "ceda_sessions_insert" ON ceda_sessions FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "ceda_sessions_update" ON ceda_sessions FOR UPDATE
  USING (auth.uid() IN (created_by, pro_user_id, con_user_id) OR status = 'recruiting');

DROP POLICY IF EXISTS "ceda_messages_select" ON ceda_messages;
DROP POLICY IF EXISTS "ceda_messages_insert" ON ceda_messages;

CREATE POLICY "ceda_messages_select" ON ceda_messages FOR SELECT USING (true);
CREATE POLICY "ceda_messages_insert" ON ceda_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ceda_votes_select" ON ceda_votes;
DROP POLICY IF EXISTS "ceda_votes_insert" ON ceda_votes;

CREATE POLICY "ceda_votes_select" ON ceda_votes FOR SELECT USING (true);
CREATE POLICY "ceda_votes_insert" ON ceda_votes FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 18. debate_requests
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS debate_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  topic TEXT NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 200),
  mode TEXT NOT NULL CHECK (mode IN ('pro','con','free')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (sender_id <> receiver_id)
);

ALTER TABLE debate_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "debate_requests_select" ON debate_requests;
DROP POLICY IF EXISTS "debate_requests_insert" ON debate_requests;
DROP POLICY IF EXISTS "debate_requests_update" ON debate_requests;

CREATE POLICY "debate_requests_select" ON debate_requests FOR SELECT USING (true);
CREATE POLICY "debate_requests_insert" ON debate_requests FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "debate_requests_update" ON debate_requests FOR UPDATE USING (auth.uid() IN (sender_id, receiver_id));


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 19. judge_early_votes
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS judge_early_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

ALTER TABLE judge_early_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read judge early votes" ON judge_early_votes;
DROP POLICY IF EXISTS "Auth users can insert own vote" ON judge_early_votes;

CREATE POLICY "Anyone can read judge early votes" ON judge_early_votes FOR SELECT USING (true);
CREATE POLICY "Auth users can insert own vote" ON judge_early_votes FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 20. 인덱스 (전체)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_threads_created_at ON threads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_ai_verdict ON threads (ai_verdict) WHERE ai_verdict IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_threads_expires_at ON threads(expires_at) WHERE is_closed = false AND expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_thread_votes_thread_user ON thread_votes (thread_id, user_id);
CREATE INDEX IF NOT EXISTS idx_comments_thread_id ON comments (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions (comment_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_thread ON bookmarks(thread_id);
CREATE INDEX IF NOT EXISTS idx_live_messages_session ON live_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fact_checks_comment ON fact_checks(comment_id);
CREATE INDEX IF NOT EXISTS idx_vote_logs_thread ON vote_logs(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tag_subscriptions_tag ON tag_subscriptions(tag);
CREATE INDEX IF NOT EXISTS idx_tag_subscriptions_user ON tag_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_mutes_user ON thread_mutes(user_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tournament_entries_tournament ON tournament_entries(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id, round);
CREATE INDEX IF NOT EXISTS idx_ceda_sessions_thread ON ceda_sessions(thread_id);
CREATE INDEX IF NOT EXISTS idx_ceda_sessions_status ON ceda_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ceda_messages_session ON ceda_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ceda_votes_session ON ceda_votes(session_id);
CREATE INDEX IF NOT EXISTS idx_comment_coaching_comment ON comment_coaching(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_sentiments_comment ON comment_sentiments(comment_id);
CREATE INDEX IF NOT EXISTS idx_debate_requests_receiver ON debate_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_debate_requests_sender ON debate_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_judge_early_votes_thread ON judge_early_votes(thread_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 21. RPCs: cast_vote
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION cast_vote(
  p_thread_id UUID,
  p_user_id   UUID,
  p_vote_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing TEXT;
  v_pro      INT;
  v_con      INT;
  v_new_vote TEXT;
  v_action   TEXT;
BEGIN
  SELECT vote_type INTO v_existing
    FROM thread_votes
   WHERE thread_id = p_thread_id AND user_id = p_user_id;

  IF v_existing IS NOT NULL AND v_existing = p_vote_type THEN
    DELETE FROM thread_votes WHERE thread_id = p_thread_id AND user_id = p_user_id;
    UPDATE threads SET
      pro_count = GREATEST(0, pro_count - CASE WHEN p_vote_type = 'pro' THEN 1 ELSE 0 END),
      con_count = GREATEST(0, con_count - CASE WHEN p_vote_type = 'con' THEN 1 ELSE 0 END)
    WHERE id = p_thread_id;
    v_new_vote := NULL;
    v_action := 'remove_' || p_vote_type;

  ELSIF v_existing IS NOT NULL THEN
    UPDATE thread_votes SET vote_type = p_vote_type
     WHERE thread_id = p_thread_id AND user_id = p_user_id;
    UPDATE threads SET
      pro_count = GREATEST(0, pro_count + CASE WHEN p_vote_type = 'pro' THEN 1 ELSE -1 END),
      con_count = GREATEST(0, con_count + CASE WHEN p_vote_type = 'con' THEN 1 ELSE -1 END)
    WHERE id = p_thread_id;
    v_new_vote := p_vote_type;
    v_action := 'switch_to_' || p_vote_type;

  ELSE
    INSERT INTO thread_votes (thread_id, user_id, vote_type) VALUES (p_thread_id, p_user_id, p_vote_type);
    UPDATE threads SET
      pro_count = pro_count + CASE WHEN p_vote_type = 'pro' THEN 1 ELSE 0 END,
      con_count = con_count + CASE WHEN p_vote_type = 'con' THEN 1 ELSE 0 END
    WHERE id = p_thread_id;
    v_new_vote := p_vote_type;
    v_action := 'new_' || p_vote_type;
  END IF;

  INSERT INTO vote_logs (thread_id, user_id, action) VALUES (p_thread_id, p_user_id, v_action);

  SELECT pro_count, con_count INTO v_pro, v_con FROM threads WHERE id = p_thread_id;

  RETURN json_build_object('pro_count', COALESCE(v_pro, 0), 'con_count', COALESCE(v_con, 0), 'new_vote', v_new_vote);
END;
$$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 22. RPCs: get_vote_trend, get_thread_timeline, get_hot_debates, get_hot_scored_debates
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION get_vote_trend(p_thread_id UUID)
RETURNS TABLE(bucket TIMESTAMPTZ, cumulative_pro BIGINT, cumulative_con BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH buckets AS (
    SELECT
      date_trunc('hour', created_at) -
        (EXTRACT(HOUR FROM created_at)::INT % 6) * INTERVAL '1 hour' AS bucket,
      vote_type
    FROM thread_votes WHERE thread_id = p_thread_id
  ),
  counts AS (
    SELECT bucket,
      COUNT(*) FILTER (WHERE vote_type = 'pro') AS pro,
      COUNT(*) FILTER (WHERE vote_type = 'con') AS con
    FROM buckets GROUP BY bucket ORDER BY bucket
  )
  SELECT bucket,
    SUM(pro) OVER (ORDER BY bucket) AS cumulative_pro,
    SUM(con) OVER (ORDER BY bucket) AS cumulative_con
  FROM counts;
$$;

CREATE OR REPLACE FUNCTION get_thread_timeline(p_thread_id UUID)
RETURNS TABLE(event_type TEXT, event_time TIMESTAMPTZ, event_data JSONB)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_created_at TIMESTAMPTZ;
  v_is_closed BOOLEAN;
  v_closed_at TIMESTAMPTZ;
  v_ai_verdict TEXT;
  v_total_votes INT;
  v_total_comments INT;
  v_nth_time TIMESTAMPTZ;
BEGIN
  SELECT t.created_at, t.is_closed, t.closed_at, t.ai_verdict
    INTO v_created_at, v_is_closed, v_closed_at, v_ai_verdict
    FROM threads t WHERE t.id = p_thread_id;

  IF v_created_at IS NULL THEN RETURN; END IF;

  event_type := 'created'; event_time := v_created_at;
  event_data := '{"label":"토론 생성"}'::JSONB;
  RETURN NEXT;

  SELECT COUNT(*) INTO v_total_votes FROM thread_votes WHERE thread_id = p_thread_id;

  FOREACH v_total_votes IN ARRAY ARRAY[10, 50, 100] LOOP
    SELECT tv.created_at INTO v_nth_time
      FROM thread_votes tv WHERE tv.thread_id = p_thread_id
      ORDER BY tv.created_at ASC OFFSET v_total_votes - 1 LIMIT 1;
    IF v_nth_time IS NOT NULL THEN
      event_type := 'vote_milestone'; event_time := v_nth_time;
      event_data := jsonb_build_object('milestone', v_total_votes, 'label', v_total_votes || '번째 투표 달성');
      RETURN NEXT;
    END IF;
  END LOOP;

  FOREACH v_total_comments IN ARRAY ARRAY[10, 30] LOOP
    SELECT c.created_at INTO v_nth_time
      FROM comments c WHERE c.thread_id = p_thread_id
      ORDER BY c.created_at ASC OFFSET v_total_comments - 1 LIMIT 1;
    IF v_nth_time IS NOT NULL THEN
      event_type := 'comment_milestone'; event_time := v_nth_time;
      event_data := jsonb_build_object('milestone', v_total_comments, 'label', v_total_comments || '번째 댓글 달성');
      RETURN NEXT;
    END IF;
  END LOOP;

  IF v_ai_verdict IS NOT NULL THEN
    SELECT COALESCE(
      (SELECT (t.ai_summary->>'judged_at')::TIMESTAMPTZ FROM threads t WHERE t.id = p_thread_id),
      NOW()
    ) INTO v_nth_time;
    event_type := 'ai_verdict'; event_time := v_nth_time;
    event_data := jsonb_build_object('verdict', v_ai_verdict, 'label', 'AI 판결 완료');
    RETURN NEXT;
  END IF;

  IF v_is_closed AND v_closed_at IS NOT NULL THEN
    event_type := 'closed'; event_time := v_closed_at;
    event_data := '{"label":"토론 마감"}'::JSONB;
    RETURN NEXT;
  END IF;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION get_hot_debates(p_limit INT DEFAULT 3)
RETURNS TABLE(
  thread_id UUID, title TEXT, tag TEXT, pro_count INT, con_count INT,
  total_votes BIGINT, comment_count BIGINT, recent_votes BIGINT,
  recent_comments BIGINT, momentum NUMERIC, participant_count BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS thread_id, t.title, t.tag, t.pro_count, t.con_count,
    (t.pro_count + t.con_count)::BIGINT AS total_votes,
    (SELECT COUNT(*) FROM comments c WHERE c.thread_id = t.id AND c.is_deleted IS NOT TRUE) AS comment_count,
    (SELECT COUNT(*) FROM thread_votes tv WHERE tv.thread_id = t.id AND tv.created_at > NOW() - INTERVAL '1 hour') AS recent_votes,
    (SELECT COUNT(*) FROM comments c2 WHERE c2.thread_id = t.id AND c2.is_deleted IS NOT TRUE AND c2.created_at > NOW() - INTERVAL '1 hour') AS recent_comments,
    CASE
      WHEN (t.pro_count + t.con_count) = 0 THEN 0
      ELSE ROUND(
        (
          (SELECT COUNT(*) FROM thread_votes tv WHERE tv.thread_id = t.id AND tv.created_at > NOW() - INTERVAL '1 hour')
          + (SELECT COUNT(*) FROM comments c3 WHERE c3.thread_id = t.id AND c3.is_deleted IS NOT TRUE AND c3.created_at > NOW() - INTERVAL '1 hour') * 2
        )::NUMERIC / GREATEST((t.pro_count + t.con_count), 1) * 100, 1
      )
    END AS momentum,
    (
      SELECT COUNT(DISTINCT sub.user_id) FROM (
        SELECT tv2.user_id FROM thread_votes tv2 WHERE tv2.thread_id = t.id
        UNION
        SELECT c4.user_id FROM comments c4 WHERE c4.thread_id = t.id
      ) sub
    ) AS participant_count
  FROM threads t
  WHERE t.is_closed = false
  ORDER BY momentum DESC, total_votes DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION get_hot_scored_debates(p_limit INT DEFAULT 5)
RETURNS TABLE(
  id UUID, title TEXT, content TEXT, tag TEXT, template TEXT,
  pro_count INT, con_count INT, created_at TIMESTAMPTZ, is_closed BOOLEAN,
  expires_at TIMESTAMPTZ, comment_count BIGINT, hot_score FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT
    t.id, t.title, t.content, t.tag, t.template, t.pro_count, t.con_count,
    t.created_at, t.is_closed, t.expires_at,
    COALESCE(cc.cnt, 0) AS comment_count,
    CASE
      WHEN EXTRACT(EPOCH FROM (now() - t.created_at)) <= 0 THEN 0
      ELSE (
        (COALESCE(t.pro_count, 0) + COALESCE(t.con_count, 0)) * 2.0
        + COALESCE(cc.cnt, 0) * 5.0
      ) / POWER(EXTRACT(EPOCH FROM (now() - t.created_at)) / 3600.0 + 2.0, 1.5)
    END AS hot_score
  FROM threads t
  LEFT JOIN (
    SELECT thread_id, COUNT(*)::BIGINT AS cnt FROM comments WHERE is_deleted IS NOT TRUE GROUP BY thread_id
  ) cc ON cc.thread_id = t.id
  WHERE t.is_closed IS NOT TRUE
  ORDER BY hot_score DESC
  LIMIT p_limit;
$$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 23. RPCs: cast_poll_vote, cast_duel_vote, CEDA RPCs
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION cast_poll_vote(p_poll_id UUID, p_user_id UUID, p_vote_type TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO comment_poll_votes (poll_id, user_id, vote_type) VALUES (p_poll_id, p_user_id, p_vote_type);
  IF p_vote_type = 'pro' THEN
    UPDATE comment_polls SET pro_count = pro_count + 1 WHERE id = p_poll_id;
  ELSE
    UPDATE comment_polls SET con_count = con_count + 1 WHERE id = p_poll_id;
  END IF;
EXCEPTION
  WHEN unique_violation THEN RAISE EXCEPTION 'already_voted';
END;
$$;

CREATE OR REPLACE FUNCTION cast_duel_vote(p_duel_id UUID, p_user_id UUID, p_voted_for UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_challenger UUID; v_opponent UUID;
BEGIN
  SELECT challenger_id, opponent_id INTO v_challenger, v_opponent
  FROM duels WHERE id = p_duel_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'duel_not_active'; END IF;
  IF p_user_id = v_challenger OR p_user_id = v_opponent THEN RAISE EXCEPTION 'participant_cannot_vote'; END IF;
  INSERT INTO duel_votes (duel_id, user_id, voted_for) VALUES (p_duel_id, p_user_id, p_voted_for);
  IF p_voted_for = v_challenger THEN
    UPDATE duels SET vote_challenger = vote_challenger + 1 WHERE id = p_duel_id;
  ELSIF p_voted_for = v_opponent THEN
    UPDATE duels SET vote_opponent = vote_opponent + 1 WHERE id = p_duel_id;
  END IF;
EXCEPTION
  WHEN unique_violation THEN RAISE EXCEPTION 'already_voted';
END;
$$;

CREATE OR REPLACE FUNCTION join_ceda_session(p_session_id UUID, p_user_id UUID, p_side TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session ceda_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM ceda_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session IS NULL THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF v_session.status <> 'recruiting' THEN RAISE EXCEPTION 'session_not_recruiting'; END IF;
  IF p_side = 'pro' THEN
    IF v_session.pro_user_id IS NOT NULL THEN RAISE EXCEPTION 'slot_taken'; END IF;
    UPDATE ceda_sessions SET pro_user_id = p_user_id WHERE id = p_session_id;
  ELSIF p_side = 'con' THEN
    IF v_session.con_user_id IS NOT NULL THEN RAISE EXCEPTION 'slot_taken'; END IF;
    UPDATE ceda_sessions SET con_user_id = p_user_id WHERE id = p_session_id;
  ELSE RAISE EXCEPTION 'invalid_side';
  END IF;
  SELECT * INTO v_session FROM ceda_sessions WHERE id = p_session_id;
  IF v_session.pro_user_id IS NOT NULL AND v_session.con_user_id IS NOT NULL THEN
    UPDATE ceda_sessions SET status = 'ready' WHERE id = p_session_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION advance_ceda_phase(p_session_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session ceda_sessions%ROWTYPE;
  v_phases  TEXT[] := ARRAY['pro_constructive','cross_exam_by_con','con_constructive','cross_exam_by_pro','pro_rebuttal','con_rebuttal'];
  v_phase_speakers TEXT[] := ARRAY['pro','con','con','pro','pro','con'];
  v_next_index INT;
  v_speaker_id UUID;
BEGIN
  SELECT * INTO v_session FROM ceda_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session IS NULL THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF p_user_id NOT IN (v_session.created_by, v_session.pro_user_id, v_session.con_user_id) THEN RAISE EXCEPTION 'not_participant'; END IF;

  IF v_session.status = 'ready' AND v_session.current_phase = 'waiting' THEN
    UPDATE ceda_sessions SET status = 'active', current_phase = v_phases[1], phase_index = 0, phase_started_at = now(), started_at = now(), current_speaker_id = v_session.pro_user_id WHERE id = p_session_id;
    RETURN;
  END IF;
  IF v_session.status <> 'active' THEN RAISE EXCEPTION 'session_not_active'; END IF;

  v_next_index := v_session.phase_index + 1;
  IF v_next_index >= 6 THEN
    UPDATE ceda_sessions SET current_phase = 'finished', phase_index = 6, status = 'completed', completed_at = now(), current_speaker_id = NULL WHERE id = p_session_id;
  ELSE
    IF v_phase_speakers[v_next_index + 1] = 'pro' THEN v_speaker_id := v_session.pro_user_id;
    ELSE v_speaker_id := v_session.con_user_id; END IF;
    UPDATE ceda_sessions SET current_phase = v_phases[v_next_index + 1], phase_index = v_next_index, phase_started_at = now(), current_speaker_id = v_speaker_id WHERE id = p_session_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION send_ceda_message(p_session_id UUID, p_user_id UUID, p_content TEXT, p_msg_type TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session ceda_sessions%ROWTYPE; v_phase TEXT; v_allowed BOOLEAN := false; v_duration INT; v_elapsed INTERVAL; v_new_id UUID;
BEGIN
  SELECT * INTO v_session FROM ceda_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session IS NULL THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF v_session.status <> 'active' THEN RAISE EXCEPTION 'session_not_active'; END IF;
  v_phase := v_session.current_phase;

  CASE WHEN v_phase IN ('pro_constructive','con_constructive') THEN v_duration := 180;
       WHEN v_phase IN ('cross_exam_by_con','cross_exam_by_pro') THEN v_duration := 90;
       WHEN v_phase IN ('pro_rebuttal','con_rebuttal') THEN v_duration := 120;
       ELSE RAISE EXCEPTION 'invalid_phase'; END CASE;

  v_elapsed := now() - v_session.phase_started_at;
  IF EXTRACT(EPOCH FROM v_elapsed) > (v_duration + 2) THEN RAISE EXCEPTION 'phase_time_expired'; END IF;

  CASE v_phase
    WHEN 'pro_constructive' THEN v_allowed := (p_user_id = v_session.current_speaker_id AND p_msg_type = 'argument');
    WHEN 'cross_exam_by_con' THEN v_allowed := (p_user_id = v_session.con_user_id AND p_msg_type = 'question') OR (p_user_id = v_session.pro_user_id AND p_msg_type = 'answer');
    WHEN 'con_constructive' THEN v_allowed := (p_user_id = v_session.current_speaker_id AND p_msg_type = 'argument');
    WHEN 'cross_exam_by_pro' THEN v_allowed := (p_user_id = v_session.pro_user_id AND p_msg_type = 'question') OR (p_user_id = v_session.con_user_id AND p_msg_type = 'answer');
    WHEN 'pro_rebuttal' THEN v_allowed := (p_user_id = v_session.current_speaker_id AND p_msg_type = 'argument');
    WHEN 'con_rebuttal' THEN v_allowed := (p_user_id = v_session.current_speaker_id AND p_msg_type = 'argument');
    ELSE v_allowed := false;
  END CASE;

  IF NOT v_allowed THEN RAISE EXCEPTION 'permission_denied'; END IF;

  INSERT INTO ceda_messages (session_id, user_id, phase, msg_type, content) VALUES (p_session_id, p_user_id, v_phase, p_msg_type, p_content) RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION cast_ceda_vote(p_session_id UUID, p_user_id UUID, p_voted_for TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session ceda_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_session FROM ceda_sessions WHERE id = p_session_id;
  IF v_session IS NULL THEN RAISE EXCEPTION 'session_not_found'; END IF;
  IF v_session.status <> 'completed' THEN RAISE EXCEPTION 'session_not_completed'; END IF;
  IF p_user_id IN (v_session.pro_user_id, v_session.con_user_id) THEN RAISE EXCEPTION 'participant_cannot_vote'; END IF;
  INSERT INTO ceda_votes (session_id, user_id, voted_for) VALUES (p_session_id, p_user_id, p_voted_for);
EXCEPTION
  WHEN unique_violation THEN RAISE EXCEPTION 'already_voted';
END;
$$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 24. increment_xp
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION increment_xp(p_user_id UUID, p_amount INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles SET xp = xp + p_amount WHERE id = p_user_id;
END;
$$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Realtime
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- threads, comments, comment_reactions, live_sessions, live_messages,
-- fact_checks, vote_logs, tag_subscriptions, ceda_sessions, ceda_messages,
-- ceda_votes, debate_requests → Supabase Dashboard > Database > Replication에서 활성화



-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  03. XP & Achievements                                              ║
-- ║  의존성: 01_auth_and_profiles.sql, 02_debates_and_content.sql       ║
-- ╚══════════════════════════════════════════════════════════════════════╝


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. user_achievements
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_key)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_achievements_select" ON user_achievements;
DROP POLICY IF EXISTS "user_achievements_insert" ON user_achievements;

CREATE POLICY "user_achievements_select" ON user_achievements FOR SELECT USING (true);
CREATE POLICY "user_achievements_insert" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. seasons / season_rankings
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS seasons (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT false,
  rewards    JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS season_rankings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id  UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  season_xp  INT NOT NULL DEFAULT 0,
  rank       INT NOT NULL DEFAULT 0,
  UNIQUE(season_id, user_id)
);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_rankings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seasons_select" ON seasons;
CREATE POLICY "seasons_select" ON seasons FOR SELECT USING (true);

DROP POLICY IF EXISTS "season_rankings_select" ON season_rankings;
CREATE POLICY "season_rankings_select" ON season_rankings FOR SELECT USING (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. 인덱스
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_seasons_active ON seasons(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_season_rankings_season ON season_rankings(season_id, season_xp DESC);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. RPC: award_xp_with_limit (데일리 200 XP 제한 + 레벨 계산)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION award_xp_with_limit(p_user_id UUID, p_amount INT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row    profiles%ROWTYPE;
  v_remain INT;
  v_award  INT;
  v_new_xp INT;
  v_new_lv INT;
  v_new_badge TEXT;
  v_capped BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_row FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  IF v_row.daily_xp_date IS NULL OR v_row.daily_xp_date < CURRENT_DATE THEN
    v_row.daily_xp_earned := 0;
    v_row.daily_xp_date := CURRENT_DATE;
  END IF;

  v_remain := GREATEST(0, 200 - v_row.daily_xp_earned);
  v_award  := LEAST(p_amount, v_remain);
  v_capped := v_award < p_amount;

  IF v_award <= 0 THEN
    RETURN jsonb_build_object(
      'awarded', 0, 'capped', TRUE, 'new_xp', v_row.xp,
      'new_level', v_row.level, 'new_badge', v_row.badge,
      'daily_xp_earned', v_row.daily_xp_earned
    );
  END IF;

  v_new_xp := v_row.xp + v_award;
  v_new_lv := GREATEST(1, floor(sqrt(GREATEST(0, v_new_xp)::numeric / 100)) + 1);

  v_new_badge := CASE
    WHEN v_new_xp >= 601 THEN '아고라 지배자'
    WHEN v_new_xp >= 301 THEN '엘리트 해커'
    WHEN v_new_xp >= 101 THEN '사이버 용병'
    ELSE '네온 뉴비'
  END;

  UPDATE profiles
  SET xp = v_new_xp, badge = v_new_badge, level = v_new_lv,
      daily_xp_earned = v_row.daily_xp_earned + v_award,
      daily_xp_date = CURRENT_DATE
  WHERE id = p_user_id;

  UPDATE season_rankings SET season_xp = season_xp + v_award
  WHERE user_id = p_user_id
    AND season_id = (SELECT id FROM seasons WHERE is_active = TRUE LIMIT 1);

  RETURN jsonb_build_object(
    'awarded', v_award, 'capped', v_capped, 'new_xp', v_new_xp,
    'new_level', v_new_lv, 'new_badge', v_new_badge,
    'daily_xp_earned', v_row.daily_xp_earned + v_award
  );
END;
$$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. RPC: check_achievements (v7 통합 — 기본 + 스트릭 + 코치 + 시즌)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DROP FUNCTION IF EXISTS check_achievements(UUID);
CREATE OR REPLACE FUNCTION check_achievements(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_newly TEXT[] := '{}';
  v_stats JSONB;
  v_vote_count INT;
  v_comment_count INT;
  v_thread_count INT;
  v_like_count INT;
  v_night_count INT;
  v_coaching_count INT;
  v_season_rank INT;
BEGIN
  SELECT COUNT(*) INTO v_vote_count FROM thread_votes WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_comment_count FROM comments WHERE user_id = p_user_id AND is_deleted IS NOT TRUE;
  SELECT COUNT(*) INTO v_thread_count FROM threads WHERE created_by = p_user_id;
  SELECT COALESCE(SUM(CASE WHEN cr.reaction = 'like' THEN 1 ELSE 0 END), 0) INTO v_like_count
  FROM comment_reactions cr JOIN comments c ON c.id = cr.comment_id WHERE c.user_id = p_user_id;

  v_stats := jsonb_build_object('votes', v_vote_count, 'comments', v_comment_count, 'threads', v_thread_count, 'likes', v_like_count);

  -- 기본 업적
  IF v_vote_count >= 1 AND NOT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_key = 'first_vote') THEN
    INSERT INTO user_achievements (user_id, achievement_key) VALUES (p_user_id, 'first_vote') ON CONFLICT DO NOTHING;
    v_newly := array_append(v_newly, 'first_vote');
  END IF;

  IF v_comment_count >= 1 AND NOT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_key = 'first_comment') THEN
    INSERT INTO user_achievements (user_id, achievement_key) VALUES (p_user_id, 'first_comment') ON CONFLICT DO NOTHING;
    v_newly := array_append(v_newly, 'first_comment');
  END IF;

  IF v_thread_count >= 1 AND NOT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_key = 'first_thread') THEN
    INSERT INTO user_achievements (user_id, achievement_key) VALUES (p_user_id, 'first_thread') ON CONFLICT DO NOTHING;
    v_newly := array_append(v_newly, 'first_thread');
  END IF;

  IF v_thread_count >= 10 AND NOT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_key = 'debate_king') THEN
    INSERT INTO user_achievements (user_id, achievement_key) VALUES (p_user_id, 'debate_king') ON CONFLICT DO NOTHING;
    v_newly := array_append(v_newly, 'debate_king');
  END IF;

  IF v_comment_count >= 50 AND NOT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_key = 'comment_king') THEN
    INSERT INTO user_achievements (user_id, achievement_key) VALUES (p_user_id, 'comment_king') ON CONFLICT DO NOTHING;
    v_newly := array_append(v_newly, 'comment_king');
  END IF;

  IF v_like_count >= 100 AND NOT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_key = 'popular_star') THEN
    INSERT INTO user_achievements (user_id, achievement_key) VALUES (p_user_id, 'popular_star') ON CONFLICT DO NOTHING;
    v_newly := array_append(v_newly, 'popular_star');
  END IF;

  -- v7 업적
  IF v_vote_count >= 100 AND NOT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_key = 'vote_100') THEN
    INSERT INTO user_achievements (user_id, achievement_key) VALUES (p_user_id, 'vote_100') ON CONFLICT DO NOTHING;
    v_newly := array_append(v_newly, 'vote_100');
  END IF;

  IF v_comment_count >= 100 AND NOT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_key = 'debate_marathon') THEN
    INSERT INTO user_achievements (user_id, achievement_key) VALUES (p_user_id, 'debate_marathon') ON CONFLICT DO NOTHING;
    v_newly := array_append(v_newly, 'debate_marathon');
  END IF;

  -- unanimous_winner
  IF NOT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_key = 'unanimous_winner') THEN
    IF EXISTS (
      SELECT 1 FROM threads
      WHERE created_by = p_user_id AND (pro_count + con_count) >= 10
        AND pro_count::NUMERIC / GREATEST(pro_count + con_count, 1) >= 0.8
    ) THEN
      INSERT INTO user_achievements (user_id, achievement_key) VALUES (p_user_id, 'unanimous_winner') ON CONFLICT DO NOTHING;
      v_newly := array_append(v_newly, 'unanimous_winner');
    END IF;
  END IF;

  -- night_owl
  IF NOT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_key = 'night_owl') THEN
    SELECT COUNT(*) INTO v_night_count FROM comments
    WHERE user_id = p_user_id AND is_deleted IS NOT TRUE
      AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Seoul') BETWEEN 0 AND 3;
    IF v_night_count >= 10 THEN
      INSERT INTO user_achievements (user_id, achievement_key) VALUES (p_user_id, 'night_owl') ON CONFLICT DO NOTHING;
      v_newly := array_append(v_newly, 'night_owl');
    END IF;
  END IF;

  -- coach_master
  IF NOT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_key = 'coach_master') THEN
    SELECT COUNT(*) INTO v_coaching_count FROM comment_coaching WHERE user_id = p_user_id;
    IF v_coaching_count >= 10 THEN
      INSERT INTO user_achievements (user_id, achievement_key) VALUES (p_user_id, 'coach_master') ON CONFLICT DO NOTHING;
      v_newly := array_append(v_newly, 'coach_master');
    END IF;
  END IF;

  -- season_champion
  IF NOT EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_key = 'season_champion') THEN
    SELECT computed_rank INTO v_season_rank
    FROM (
      SELECT sr.user_id, ROW_NUMBER() OVER (ORDER BY sr.season_xp DESC) AS computed_rank
      FROM season_rankings sr
      JOIN seasons s ON s.id = sr.season_id AND s.is_active = false
    ) ranked
    WHERE ranked.user_id = p_user_id
    ORDER BY computed_rank ASC LIMIT 1;
    IF v_season_rank = 1 THEN
      INSERT INTO user_achievements (user_id, achievement_key) VALUES (p_user_id, 'season_champion') ON CONFLICT DO NOTHING;
      v_newly := array_append(v_newly, 'season_champion');
    END IF;
  END IF;

  RETURN jsonb_build_object('newly_unlocked', v_newly, 'stats', v_stats);
END;
$$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. RPC: 업적 헬퍼 (logic_king, agora_star)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION check_badge_logic_king(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM comment_coaching cc
  WHERE cc.user_id = p_user_id
    AND ((cc.scores->>'logic')::int + (cc.scores->>'persuasion')::int + (cc.scores->>'evidence')::int) / 3 >= 90;
  IF v_count >= 3 THEN
    INSERT INTO user_achievements (user_id, achievement_key) VALUES (p_user_id, 'logic_king') ON CONFLICT (user_id, achievement_key) DO NOTHING;
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION check_badge_agora_star(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM comment_reactions cr
  JOIN comments c ON c.id = cr.comment_id WHERE c.user_id = p_user_id AND cr.reaction = 'like';
  IF v_count >= 50 THEN
    INSERT INTO user_achievements (user_id, achievement_key) VALUES (p_user_id, 'agora_star') ON CONFLICT (user_id, achievement_key) DO NOTHING;
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. RPC: add_season_xp, get_season_leaderboard, update_streak
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION add_season_xp(p_user_id UUID, p_amount INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_season_id UUID;
BEGIN
  SELECT id INTO v_season_id FROM seasons WHERE is_active = true LIMIT 1;
  IF v_season_id IS NULL THEN RETURN; END IF;
  INSERT INTO season_rankings (season_id, user_id, season_xp, rank) VALUES (v_season_id, p_user_id, p_amount, 0)
  ON CONFLICT (season_id, user_id) DO UPDATE SET season_xp = season_rankings.season_xp + p_amount;
  UPDATE profiles SET season_xp = season_xp + p_amount WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_season_leaderboard(p_season_id UUID, p_limit INT DEFAULT 20)
RETURNS TABLE(user_id UUID, season_xp INT, rank BIGINT, badge TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT sr.user_id, sr.season_xp,
    ROW_NUMBER() OVER (ORDER BY sr.season_xp DESC) AS rank,
    COALESCE(p.badge, '네온 뉴비') AS badge
  FROM season_rankings sr LEFT JOIN profiles p ON p.id = sr.user_id
  WHERE sr.season_id = p_season_id ORDER BY sr.season_xp DESC LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION update_streak(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_streak INT; v_last DATE; v_today DATE := CURRENT_DATE; v_bonus INT := 0;
BEGIN
  SELECT streak_days, last_active_date INTO v_streak, v_last FROM profiles WHERE id = p_user_id;
  IF v_last = v_today THEN
    RETURN jsonb_build_object('streak', v_streak, 'bonus', 0, 'already_today', true);
  END IF;
  IF v_last = v_today - 1 THEN v_streak := COALESCE(v_streak, 0) + 1;
  ELSE v_streak := 1; END IF;

  IF v_streak = 3 THEN v_bonus := 5;
  ELSIF v_streak = 7 THEN v_bonus := 10;
  ELSIF v_streak = 14 THEN v_bonus := 20;
  ELSIF v_streak = 30 THEN v_bonus := 30;
  END IF;

  UPDATE profiles SET streak_days = v_streak, last_active_date = v_today, xp = xp + v_bonus WHERE id = p_user_id;
  RETURN jsonb_build_object('streak', v_streak, 'bonus', v_bonus, 'already_today', false);
END;
$$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Realtime
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- user_achievements → Supabase Dashboard > Database > Replication에서 활성화



-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  04. Notifications & Admin                                          ║
-- ║  의존성: 01, 02, 03                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════╝


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. notifications
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL DEFAULT 'comment',
  thread_id    UUID,
  thread_title TEXT DEFAULT '',
  message      TEXT DEFAULT '',
  read         BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;

CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
-- INSERT는 DB 트리거(postgres role)와 service_role만 허용, 클라이언트 직접 삽입 차단
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. notification_settings
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS notification_settings (
  user_id         UUID PRIMARY KEY,
  comment_enabled BOOLEAN NOT NULL DEFAULT true,
  vote_enabled    BOOLEAN NOT NULL DEFAULT true,
  mention_enabled BOOLEAN NOT NULL DEFAULT true,
  tag_enabled     BOOLEAN NOT NULL DEFAULT true,
  duel_enabled    BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_settings_select" ON notification_settings;
DROP POLICY IF EXISTS "notification_settings_insert" ON notification_settings;
DROP POLICY IF EXISTS "notification_settings_update" ON notification_settings;

CREATE POLICY "notification_settings_select" ON notification_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notification_settings_insert" ON notification_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notification_settings_update" ON notification_settings FOR UPDATE USING (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. reports / blocks
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('comment', 'thread', 'user')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('욕설', '스팸', '허위정보', '기타')),
  detail TEXT CHECK (detail IS NULL OR char_length(detail) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v10: 신고 관리 확장
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending','resolved','dismissed'));
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES auth.users(id),
  blocked_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert" ON reports;
DROP POLICY IF EXISTS "reports_select" ON reports;

CREATE POLICY "reports_insert" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_select" ON reports FOR SELECT USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "blocks_insert" ON blocks;
DROP POLICY IF EXISTS "blocks_select" ON blocks;
DROP POLICY IF EXISTS "blocks_delete" ON blocks;

CREATE POLICY "blocks_insert" ON blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocks_select" ON blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "blocks_delete" ON blocks FOR DELETE USING (auth.uid() = blocker_id);

-- 관리자 RLS (v10)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_read_reports' AND tablename = 'reports') THEN
    CREATE POLICY admin_read_reports ON reports FOR SELECT
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_update_reports' AND tablename = 'reports') THEN
    CREATE POLICY admin_update_reports ON reports FOR UPDATE
      USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
  END IF;
END $$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. admin_logs
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS admin_logs (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_logs_select_admin" ON admin_logs;
CREATE POLICY "admin_logs_select_admin" ON admin_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. 트리거: notify_on_comment
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_created_by UUID; v_thread_title TEXT;
BEGIN
  BEGIN
    SELECT created_by, title INTO v_created_by, v_thread_title FROM threads WHERE id = NEW.thread_id;
  EXCEPTION WHEN undefined_column THEN RETURN NEW;
  END;

  IF v_created_by IS NULL OR v_created_by = NEW.user_id THEN RETURN NEW; END IF;

  INSERT INTO notifications (user_id, type, thread_id, thread_title, message)
  VALUES (v_created_by, 'comment', NEW.thread_id, COALESCE(v_thread_title, ''), '누군가 회원님의 토론에 댓글을 달았어요.');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_comment_notification ON comments;
CREATE TRIGGER trigger_comment_notification
  AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION notify_on_comment();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. 트리거: notify_on_vote (1시간 중복 방지)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION notify_on_vote()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_created_by UUID; v_thread_title TEXT;
BEGIN
  BEGIN
    SELECT created_by, title INTO v_created_by, v_thread_title FROM threads WHERE id = NEW.thread_id;
  EXCEPTION WHEN undefined_column THEN RETURN NEW;
  END;

  IF v_created_by IS NULL OR v_created_by = NEW.user_id THEN RETURN NEW; END IF;

  INSERT INTO notifications (user_id, type, thread_id, thread_title, message)
  SELECT v_created_by, 'vote', NEW.thread_id, COALESCE(v_thread_title, ''), '누군가 회원님의 토론에 투표했어요.'
  WHERE NOT EXISTS (
    SELECT 1 FROM notifications
     WHERE user_id = v_created_by AND thread_id = NEW.thread_id
       AND type = 'vote' AND created_at > now() - interval '1 hour'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_vote_notification ON thread_votes;
CREATE TRIGGER trigger_vote_notification
  AFTER INSERT ON thread_votes FOR EACH ROW EXECUTE FUNCTION notify_on_vote();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. 트리거: notify_on_mention
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION notify_on_mention()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  mention_match TEXT; mentioned_uid UUID; thread_row RECORD;
BEGIN
  SELECT id, title INTO thread_row FROM threads WHERE id = NEW.thread_id;

  FOR mention_match IN
    SELECT (regexp_matches(NEW.content, '@\[[^\]]+\]\(([0-9a-f\-]{36})\)', 'g'))[1]
  LOOP
    mentioned_uid := mention_match::UUID;
    IF mentioned_uid = NEW.user_id THEN CONTINUE; END IF;
    INSERT INTO notifications (user_id, type, thread_id, thread_title, message, read)
    VALUES (mentioned_uid, 'mention', NEW.thread_id, COALESCE(thread_row.title, ''), '댓글에서 회원님을 멘션했습니다.', false);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_mention ON comments;
CREATE TRIGGER trg_notify_mention
  AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION notify_on_mention();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 8. 트리거: notify_tag_subscribers
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION notify_tag_subscribers()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE sub RECORD;
BEGIN
  IF NEW.tag IS NULL OR NEW.tag = '' THEN RETURN NEW; END IF;

  FOR sub IN
    SELECT user_id FROM tag_subscriptions
    WHERE tag = NEW.tag AND user_id <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::UUID)
  LOOP
    INSERT INTO notifications (user_id, type, thread_id, thread_title, message)
    VALUES (sub.user_id, 'tag_thread', NEW.id, COALESCE(NEW.title, ''),
      '구독 중인 [' || NEW.tag || '] 카테고리에 새 토론이 올라왔어요!');
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_tag_subscription_notification ON threads;
CREATE TRIGGER trigger_tag_subscription_notification
  AFTER INSERT ON threads FOR EACH ROW EXECUTE FUNCTION notify_tag_subscribers();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 9. 트리거: notify_on_duel_challenge
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION notify_on_duel_challenge()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_thread_title TEXT;
BEGIN
  SELECT title INTO v_thread_title FROM threads WHERE id = NEW.thread_id;
  INSERT INTO notifications (user_id, type, thread_id, thread_title, message)
  VALUES (NEW.opponent_id, 'duel', NEW.thread_id, COALESCE(v_thread_title, ''),
    '대결 신청이 도착했습니다! 수락하고 논쟁을 펼쳐보세요.');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_duel_challenge ON duels;
CREATE TRIGGER trg_notify_duel_challenge
  AFTER INSERT ON duels FOR EACH ROW EXECUTE FUNCTION notify_on_duel_challenge();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 10. 트리거: notify_debate_request
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION notify_debate_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE sender_name TEXT;
BEGIN
  SELECT COALESCE(display_name, LEFT(NEW.sender_id::TEXT, 8))
    INTO sender_name FROM profiles WHERE id = NEW.sender_id;

  INSERT INTO notifications (user_id, type, thread_id, thread_title, message, read)
  VALUES (NEW.receiver_id, 'debate_request', NULL, NEW.topic,
    sender_name || '님이 토론을 신청했습니다: ' || LEFT(NEW.topic, 60), false);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_debate_request_notification ON debate_requests;
CREATE TRIGGER trg_debate_request_notification
  AFTER INSERT ON debate_requests FOR EACH ROW EXECUTE FUNCTION notify_debate_request();


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 11. RPC: get_vote_activity
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION get_vote_activity(p_thread_id UUID, p_limit INT DEFAULT 20)
RETURNS TABLE(id UUID, user_id UUID, action TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT vl.id, vl.user_id, vl.action, vl.created_at
  FROM vote_logs vl
  WHERE vl.thread_id = p_thread_id
  ORDER BY vl.created_at DESC
  LIMIT p_limit;
$$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 12. 인덱스
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Realtime
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- notifications → Supabase Dashboard > Database > Replication에서 활성화

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 17. Rate Limiter (Serverless 환경용)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS rate_limits (
  key         TEXT PRIMARY KEY,
  count       INTEGER NOT NULL DEFAULT 1,
  window_ms   BIGINT NOT NULL,
  reset_at    TIMESTAMPTZ NOT NULL
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits (reset_at);

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_ms BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_reset_at TIMESTAMPTZ;
  v_count INTEGER;
  v_retry_after INTEGER;
BEGIN
  SELECT count, reset_at INTO v_count, v_reset_at
  FROM rate_limits
  WHERE key = p_key
  FOR UPDATE;

  IF NOT FOUND OR v_reset_at <= v_now THEN
    INSERT INTO rate_limits (key, count, window_ms, reset_at)
    VALUES (p_key, 1, p_window_ms, v_now + (p_window_ms || ' milliseconds')::interval)
    ON CONFLICT (key) DO UPDATE
    SET count = 1,
        window_ms = p_window_ms,
        reset_at = v_now + (p_window_ms || ' milliseconds')::interval;
    RETURN json_build_object('allowed', true);
  END IF;

  v_count := v_count + 1;
  UPDATE rate_limits SET count = v_count WHERE key = p_key;

  IF v_count > p_limit THEN
    v_retry_after := GREATEST(1, EXTRACT(EPOCH FROM (v_reset_at - v_now))::INTEGER);
    RETURN json_build_object('allowed', false, 'retry_after', v_retry_after);
  END IF;

  RETURN json_build_object('allowed', true);
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM rate_limits WHERE reset_at <= now();
END;
$$;

NOTIFY pgrst, 'reload schema';
