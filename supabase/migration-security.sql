-- ============================================================
-- migration-security.sql
-- 보안 마이그레이션: CHECK 제약조건 + Rate Limiter 테이블/RPC
-- ※ 기존 데이터 위반 자동 보정 후 제약조건 추가 (재실행 안전)
-- ============================================================

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1-A. 기존 위반 데이터 보정
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- threads: 제목 100자 초과 → 잘라내기, 빈 제목 → 기본값
UPDATE threads SET title = LEFT(title, 100) WHERE char_length(title) > 100;
UPDATE threads SET title = '(제목 없음)' WHERE title IS NULL OR char_length(title) < 1;

-- threads: 내용 500자 초과 → 잘라내기
UPDATE threads SET content = LEFT(content, 500) WHERE content IS NOT NULL AND char_length(content) > 500;

-- comments: 내용 500자 초과 → 잘라내기, 빈 내용 → 기본값
UPDATE comments SET content = LEFT(content, 500) WHERE char_length(content) > 500;
UPDATE comments SET content = '(내용 없음)' WHERE content IS NULL OR char_length(content) < 1;

-- reports: 상세 1000자 초과 → 잘라내기
UPDATE reports SET detail = LEFT(detail, 1000) WHERE detail IS NOT NULL AND char_length(detail) > 1000;

-- profiles: 닉네임 20자 초과 → 잘라내기
UPDATE profiles SET display_name = LEFT(display_name, 20) WHERE display_name IS NOT NULL AND char_length(display_name) > 20;

-- profiles: 자기소개 200자 초과 → 잘라내기
UPDATE profiles SET bio = LEFT(bio, 200) WHERE bio IS NOT NULL AND char_length(bio) > 200;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1-B. CHECK 제약조건 추가 (IF NOT EXISTS 패턴)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- threads.title: 1~100자
ALTER TABLE threads DROP CONSTRAINT IF EXISTS chk_threads_title_length;
ALTER TABLE threads
  ADD CONSTRAINT chk_threads_title_length
  CHECK (char_length(title) BETWEEN 1 AND 100);

-- threads.content: 최대 500자
ALTER TABLE threads DROP CONSTRAINT IF EXISTS chk_threads_content_length;
ALTER TABLE threads
  ADD CONSTRAINT chk_threads_content_length
  CHECK (char_length(content) <= 500);

-- comments.content: 1~500자
ALTER TABLE comments DROP CONSTRAINT IF EXISTS chk_comments_content_length;
ALTER TABLE comments
  ADD CONSTRAINT chk_comments_content_length
  CHECK (char_length(content) BETWEEN 1 AND 500);

-- reports.detail: 최대 1000자
ALTER TABLE reports DROP CONSTRAINT IF EXISTS chk_reports_detail_length;
ALTER TABLE reports
  ADD CONSTRAINT chk_reports_detail_length
  CHECK (detail IS NULL OR char_length(detail) <= 1000);

-- profiles.display_name: 최대 20자
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_display_name_length;
ALTER TABLE profiles
  ADD CONSTRAINT chk_profiles_display_name_length
  CHECK (display_name IS NULL OR char_length(display_name) <= 20);

-- profiles.bio: 최대 200자
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_bio_length;
ALTER TABLE profiles
  ADD CONSTRAINT chk_profiles_bio_length
  CHECK (bio IS NULL OR char_length(bio) <= 200);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1-C. 알림 RLS 보안 강화
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. Rate Limiter 테이블 + RPC (Serverless 환경용)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS rate_limits (
  key         TEXT PRIMARY KEY,
  count       INTEGER NOT NULL DEFAULT 1,
  window_ms   BIGINT NOT NULL,
  reset_at    TIMESTAMPTZ NOT NULL
);

-- RLS 비활성화 (service_role만 접근)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- RLS 정책 없음 → service_role만 접근 가능

-- 만료된 항목 정리용 인덱스
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits (reset_at);

-- ── check_rate_limit RPC ──
-- 원자적으로 카운트를 증가시키고 초과 여부 반환
-- 반환: allowed=true면 통과, false면 429 응답 필요
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
  -- 기존 항목 잠금
  SELECT count, reset_at INTO v_count, v_reset_at
  FROM rate_limits
  WHERE key = p_key
  FOR UPDATE;

  IF NOT FOUND OR v_reset_at <= v_now THEN
    -- 새 윈도우 시작
    INSERT INTO rate_limits (key, count, window_ms, reset_at)
    VALUES (p_key, 1, p_window_ms, v_now + (p_window_ms || ' milliseconds')::interval)
    ON CONFLICT (key) DO UPDATE
    SET count = 1,
        window_ms = p_window_ms,
        reset_at = v_now + (p_window_ms || ' milliseconds')::interval;

    RETURN json_build_object('allowed', true);
  END IF;

  -- 카운트 증가
  v_count := v_count + 1;

  UPDATE rate_limits
  SET count = v_count
  WHERE key = p_key;

  IF v_count > p_limit THEN
    v_retry_after := GREATEST(1, EXTRACT(EPOCH FROM (v_reset_at - v_now))::INTEGER);
    RETURN json_build_object('allowed', false, 'retry_after', v_retry_after);
  END IF;

  RETURN json_build_object('allowed', true);
END;
$$;

-- ── cleanup_rate_limits RPC ──
-- 만료된 항목 삭제
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM rate_limits WHERE reset_at <= now();
END;
$$;
