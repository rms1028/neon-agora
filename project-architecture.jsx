import { useState } from "react";

const tabs = ["ERD", "폴더 구조", "티어 & 배지", "투표 플로우"];

// Color tokens
const C = {
  bg: "#0a0a0f",
  surface: "#12121a",
  surfaceHover: "#1a1a26",
  border: "#2a2a3a",
  accent: "#6c5ce7",
  accentSoft: "#6c5ce720",
  green: "#00b894",
  red: "#e17055",
  yellow: "#fdcb6e",
  blue: "#74b9ff",
  text: "#e8e8f0",
  textMuted: "#8888a0",
  textDim: "#55556a",
};

function Badge({ children, color = C.accent }) {
  return (
    <span
      style={{
        background: color + "20",
        color: color,
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.5px",
      }}
    >
      {children}
    </span>
  );
}

function TableCard({ title, badge, fields, relations }) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: "10px",
        overflow: "hidden",
        minWidth: 260,
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: C.accentSoft,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "14px", color: C.text }}>
          {title}
        </span>
        {badge && <Badge>{badge}</Badge>}
      </div>
      <div style={{ padding: "8px 0" }}>
        {fields.map((f, i) => (
          <div
            key={i}
            style={{
              padding: "5px 16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: f.pk ? C.yellow : f.fk ? C.blue : C.textMuted,
            }}
          >
            {f.pk && (
              <span style={{ fontSize: "10px", color: C.yellow }}>🔑</span>
            )}
            {f.fk && (
              <span style={{ fontSize: "10px", color: C.blue }}>🔗</span>
            )}
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {f.name}
            </span>
            <span style={{ color: C.textDim, marginLeft: "auto", fontSize: "11px" }}>
              {f.type}
            </span>
          </div>
        ))}
      </div>
      {relations && (
        <div
          style={{
            padding: "8px 16px",
            borderTop: `1px solid ${C.border}`,
            fontSize: "11px",
            color: C.textDim,
          }}
        >
          {relations.map((r, i) => (
            <div key={i} style={{ marginBottom: 2 }}>
              → {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ERDTab() {
  return (
    <div>
      <p style={{ color: C.textMuted, marginBottom: 24, lineHeight: 1.7, fontSize: "14px" }}>
        Supabase(PostgreSQL) 기반 총 <strong style={{ color: C.accent }}>8개 테이블</strong> 설계입니다.
        Supabase Auth의 <code style={{ color: C.yellow, background: C.yellow + "15", padding: "1px 6px", borderRadius: 4 }}>auth.users</code>를
        기본으로, 아래 public 스키마 테이블들이 연결됩니다.
      </p>

      {/* Row 1: Core User */}
      <h3 style={{ color: C.text, fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
        🧑 Core — 유저 & 프로필
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
        <TableCard
          title="profiles"
          badge="1:1 auth.users"
          fields={[
            { name: "id", type: "uuid", pk: true },
            { name: "username", type: "text (unique)" },
            { name: "display_name", type: "text" },
            { name: "avatar_url", type: "text?" },
            { name: "bio", type: "text?" },
            { name: "points", type: "int (default: 1000)" },
            { name: "tier", type: "enum (observer→sage)" },
            { name: "total_bets", type: "int" },
            { name: "win_count", type: "int" },
            { name: "win_rate", type: "float (computed)" },
            { name: "created_at", type: "timestamptz" },
          ]}
          relations={["auth.users.id → profiles.id (trigger on signup)"]}
        />
        <TableCard
          title="badges"
          badge="정적 마스터"
          fields={[
            { name: "id", type: "uuid", pk: true },
            { name: "name", type: "text" },
            { name: "description", type: "text" },
            { name: "icon_url", type: "text" },
            { name: "condition_type", type: "enum" },
            { name: "condition_value", type: "int" },
            { name: "tier_required", type: "enum?" },
          ]}
        />
        <TableCard
          title="user_badges"
          badge="N:M 조인"
          fields={[
            { name: "id", type: "uuid", pk: true },
            { name: "user_id", type: "uuid", fk: true },
            { name: "badge_id", type: "uuid", fk: true },
            { name: "equipped", type: "boolean" },
            { name: "earned_at", type: "timestamptz" },
          ]}
          relations={["profiles.id → user_badges.user_id", "badges.id → user_badges.badge_id"]}
        />
      </div>

      {/* Row 2: Debates */}
      <h3 style={{ color: C.text, fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
        🔥 Debates — 토론 & 댓글
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
        <TableCard
          title="debates"
          badge="핵심 엔티티"
          fields={[
            { name: "id", type: "uuid", pk: true },
            { name: "author_id", type: "uuid", fk: true },
            { name: "title", type: "text" },
            { name: "description", type: "text" },
            { name: "category", type: "enum (찬반/가치탐구/자유)" },
            { name: "status", type: "enum (open/closed/resolved)" },
            { name: "resolution", type: "enum? (pro/con/draw)" },
            { name: "total_pool", type: "int (default: 0)" },
            { name: "pro_pool", type: "int" },
            { name: "con_pool", type: "int" },
            { name: "deadline", type: "timestamptz?" },
            { name: "created_at", type: "timestamptz" },
            { name: "updated_at", type: "timestamptz" },
          ]}
          relations={["profiles.id → debates.author_id"]}
        />
        <TableCard
          title="comments"
          badge="스레드형"
          fields={[
            { name: "id", type: "uuid", pk: true },
            { name: "debate_id", type: "uuid", fk: true },
            { name: "author_id", type: "uuid", fk: true },
            { name: "parent_id", type: "uuid? (self-ref)", fk: true },
            { name: "content", type: "text" },
            { name: "stance", type: "enum? (pro/con/neutral)" },
            { name: "likes_count", type: "int" },
            { name: "created_at", type: "timestamptz" },
            { name: "updated_at", type: "timestamptz" },
          ]}
          relations={[
            "debates.id → comments.debate_id",
            "profiles.id → comments.author_id",
            "comments.id → comments.parent_id (대댓글)",
          ]}
        />
      </div>

      {/* Row 3: Betting */}
      <h3 style={{ color: C.text, fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
        💰 Betting — 포인트 베팅 & 트랜잭션
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
        <TableCard
          title="bets"
          badge="폴리마켓 핵심"
          fields={[
            { name: "id", type: "uuid", pk: true },
            { name: "user_id", type: "uuid", fk: true },
            { name: "debate_id", type: "uuid", fk: true },
            { name: "side", type: "enum (pro/con)" },
            { name: "amount", type: "int (min: 10)" },
            { name: "potential_payout", type: "float" },
            { name: "status", type: "enum (active/won/lost/refunded)" },
            { name: "created_at", type: "timestamptz" },
          ]}
          relations={[
            "profiles.id → bets.user_id",
            "debates.id → bets.debate_id",
          ]}
        />
        <TableCard
          title="point_transactions"
          badge="원장(Ledger)"
          fields={[
            { name: "id", type: "uuid", pk: true },
            { name: "user_id", type: "uuid", fk: true },
            { name: "amount", type: "int (+/-)" },
            { name: "type", type: "enum (signup/bet/win/refund/badge)" },
            { name: "reference_id", type: "uuid?" },
            { name: "description", type: "text?" },
            { name: "created_at", type: "timestamptz" },
          ]}
          relations={["profiles.id → point_transactions.user_id"]}
        />
      </div>

      {/* RLS Note */}
      <div
        style={{
          background: C.accent + "10",
          border: `1px solid ${C.accent}40`,
          borderRadius: 8,
          padding: "14px 18px",
          marginTop: 8,
          fontSize: "13px",
          color: C.textMuted,
          lineHeight: 1.7,
        }}
      >
        <strong style={{ color: C.accent }}>💡 보안 & RLS 정책</strong>
        <br />
        • 모든 테이블에 RLS(Row Level Security) 활성화 — 본인 데이터만 수정/삭제 가능
        <br />
        • <code style={{ color: C.yellow }}>point_transactions</code>는 INSERT ONLY (삭제/수정 불가 — 원장 무결성)
        <br />
        • 베팅(bets) INSERT 시 DB Function으로 포인트 차감 → 트랜잭션 원자성 보장
        <br />
        • 토론 종료(resolve) 시 Edge Function으로 승자 배분 로직 실행
      </div>
    </div>
  );
}

function FolderTab() {
  const tree = [
    { depth: 0, label: "📁 src/", type: "dir" },
    { depth: 1, label: "📁 app/", type: "dir", note: "Next.js App Router" },
    { depth: 2, label: "layout.tsx", note: "Root layout + Supabase Provider" },
    { depth: 2, label: "page.tsx", note: "랜딩 / 홈" },
    { depth: 2, label: "📁 (auth)/", note: "인증 그룹 라우트" },
    { depth: 3, label: "login/page.tsx" },
    { depth: 3, label: "signup/page.tsx" },
    { depth: 3, label: "callback/route.ts", note: "OAuth callback" },
    { depth: 2, label: "📁 debates/", note: "토론 메인" },
    { depth: 3, label: "page.tsx", note: "토론 목록 (피드)" },
    { depth: 3, label: "new/page.tsx", note: "토론 생성" },
    { depth: 3, label: "[id]/page.tsx", note: "토론 상세 + 댓글 + 베팅" },
    { depth: 3, label: "[id]/edit/page.tsx", note: "토론 수정" },
    { depth: 2, label: "📁 profile/", note: "프로필" },
    { depth: 3, label: "[username]/page.tsx", note: "유저 프로필 + 배지" },
    { depth: 3, label: "settings/page.tsx", note: "내 정보 수정" },
    { depth: 2, label: "📁 leaderboard/", note: "랭킹" },
    { depth: 3, label: "page.tsx", note: "티어별 랭킹 보드" },
    { depth: 2, label: "📁 api/", note: "Route Handlers" },
    { depth: 3, label: "debates/resolve/route.ts", note: "토론 종료 + 정산" },
    { depth: 3, label: "bets/place/route.ts", note: "베팅 처리 (트랜잭션)" },
    { depth: 1, label: "📁 components/", type: "dir" },
    { depth: 2, label: "📁 ui/", note: "shadcn/ui 컴포넌트" },
    { depth: 2, label: "📁 debate/", note: "DebateCard, DebateForm, CommentThread" },
    { depth: 2, label: "📁 betting/", note: "BettingPanel, OddsDisplay, PoolBar" },
    { depth: 2, label: "📁 gamification/", note: "TierBadge, BadgeGrid, XPBar" },
    { depth: 2, label: "📁 layout/", note: "Navbar, Sidebar, Footer" },
    { depth: 1, label: "📁 lib/", type: "dir" },
    { depth: 2, label: "supabase/client.ts", note: "브라우저 클라이언트" },
    { depth: 2, label: "supabase/server.ts", note: "서버 클라이언트" },
    { depth: 2, label: "supabase/middleware.ts", note: "세션 리프레시" },
    { depth: 2, label: "supabase/types.ts", note: "DB 타입 (자동생성)" },
    { depth: 2, label: "betting.ts", note: "배당률 계산, 풀 계산 유틸" },
    { depth: 2, label: "tier.ts", note: "티어 계산 로직" },
    { depth: 2, label: "constants.ts", note: "티어/배지/카테고리 상수" },
    { depth: 1, label: "📁 stores/", type: "dir", note: "Zustand" },
    { depth: 2, label: "useAuthStore.ts", note: "인증 상태" },
    { depth: 2, label: "useDebateStore.ts", note: "토론 필터/정렬" },
    { depth: 1, label: "📁 hooks/", type: "dir" },
    { depth: 2, label: "useProfile.ts" },
    { depth: 2, label: "useDebate.ts" },
    { depth: 2, label: "useBetting.ts" },
    { depth: 0, label: "middleware.ts", note: "인증 미들웨어 (루트)" },
    { depth: 0, label: "supabase/migrations/", note: "SQL 마이그레이션 파일" },
  ];

  return (
    <div>
      <p style={{ color: C.textMuted, marginBottom: 20, lineHeight: 1.7, fontSize: "14px" }}>
        Next.js 14+ <strong style={{ color: C.accent }}>App Router</strong> 기반, feature-based 구조입니다.
      </p>
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "16px 0",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: "13px",
          overflowX: "auto",
        }}
      >
        {tree.map((item, i) => (
          <div
            key={i}
            style={{
              padding: "4px 20px",
              paddingLeft: 20 + item.depth * 24,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: item.type === "dir" ? C.text : C.textMuted,
              fontWeight: item.type === "dir" ? 600 : 400,
              background: item.type === "dir" ? C.accentSoft : "transparent",
            }}
          >
            <span>{item.label}</span>
            {item.note && (
              <span style={{ color: C.textDim, fontSize: "11px", marginLeft: "auto" }}>
                // {item.note}
              </span>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          background: C.green + "10",
          border: `1px solid ${C.green}40`,
          borderRadius: 8,
          padding: "14px 18px",
          marginTop: 20,
          fontSize: "13px",
          color: C.textMuted,
          lineHeight: 1.7,
        }}
      >
        <strong style={{ color: C.green }}>📌 구조 설계 원칙</strong>
        <br />
        • <strong>Route Group</strong> — (auth)로 인증 관련 라우트 묶기 (레이아웃 분리)
        <br />
        • <strong>Feature-based components</strong> — debate/, betting/, gamification/ 으로 관심사 분리
        <br />
        • <strong>Server/Client 분리</strong> — 페이지는 최대한 Server Component, 인터랙션은 'use client'
        <br />
        • <strong>API Route</strong> — 포인트 트랜잭션 같은 민감 로직은 서버에서만 실행
      </div>
    </div>
  );
}

function TierTab() {
  const tiers = [
    {
      name: "관찰자 (Observer)",
      icon: "👁️",
      color: "#8888a0",
      range: "0 ~ 99 XP",
      desc: "가입 직후 기본 티어. 토론 열람 및 기본 베팅 가능.",
      perks: ["기본 베팅 (최대 100P)", "댓글 작성"],
    },
    {
      name: "토론자 (Debater)",
      icon: "⚔️",
      color: "#74b9ff",
      range: "100 ~ 499 XP",
      desc: "첫 토론 발제 또는 10회 이상 베팅 참여 시 승급.",
      perks: ["토론 발제 가능", "베팅 한도 500P", "프로필 테두리"],
    },
    {
      name: "논객 (Advocate)",
      icon: "🔥",
      color: "#e17055",
      range: "500 ~ 1,499 XP",
      desc: "승률 55% 이상 & 50회 이상 베팅 참여.",
      perks: ["베팅 한도 2,000P", "댓글 하이라이트", "전용 배지 슬롯 +1"],
    },
    {
      name: "현자 (Sage)",
      icon: "🏛️",
      color: "#fdcb6e",
      range: "1,500+ XP",
      desc: "승률 60% 이상 & 100회 이상 베팅 + 토론 발제 20회 이상.",
      perks: [
        "무제한 베팅",
        "토론 종료 권한 (투표)",
        "특별 현자 배지",
        "이름 골드 효과",
      ],
    },
  ];

  const badgeExamples = [
    { icon: "🎯", name: "명사수", desc: "베팅 연속 5회 적중" },
    { icon: "📝", name: "발제왕", desc: "토론 10개 이상 생성" },
    { icon: "💬", name: "수다쟁이", desc: "댓글 100개 이상 작성" },
    { icon: "🏆", name: "대어", desc: "단일 베팅 1,000P 이상 수익" },
    { icon: "🔮", name: "예언자", desc: "승률 70% 이상 (최소 30회)" },
    { icon: "⭐", name: "인기인", desc: "받은 좋아요 총 500개 이상" },
  ];

  return (
    <div>
      <p style={{ color: C.textMuted, marginBottom: 24, lineHeight: 1.7, fontSize: "14px" }}>
        활동량(XP)과 승률에 기반한 <strong style={{ color: C.accent }}>4단계 티어</strong>와
        도전 과제형 <strong style={{ color: C.accent }}>배지</strong> 시스템입니다.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
        {tiers.map((t, i) => (
          <div
            key={i}
            style={{
              background: C.surface,
              border: `1px solid ${t.color}30`,
              borderLeft: `4px solid ${t.color}`,
              borderRadius: 10,
              padding: "16px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{t.icon}</span>
              <span style={{ fontWeight: 700, color: t.color, fontSize: "16px" }}>
                {t.name}
              </span>
              <Badge color={t.color}>{t.range}</Badge>
            </div>
            <p style={{ color: C.textMuted, fontSize: "13px", margin: "0 0 10px" }}>
              {t.desc}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {t.perks.map((p, j) => (
                <span
                  key={j}
                  style={{
                    background: t.color + "15",
                    color: t.color,
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontSize: "11px",
                    fontWeight: 500,
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ color: C.text, fontSize: "13px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
        🏅 배지 예시
      </h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        {badgeExamples.map((b, i) => (
          <div
            key={i}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 22 }}>{b.icon}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "13px", color: C.text }}>
                {b.name}
              </div>
              <div style={{ fontSize: "11px", color: C.textDim }}>{b.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowTab() {
  const steps = [
    {
      num: "01",
      title: "토론 생성",
      desc: "발제자가 제목, 설명, 카테고리(찬반/가치탐구), 마감일을 설정하여 토론을 엽니다.",
      detail: "debates 테이블에 INSERT → status: 'open'",
      color: C.accent,
    },
    {
      num: "02",
      title: "베팅 참여",
      desc: "유저가 찬성(PRO) 또는 반대(CON)에 포인트를 베팅합니다. 베팅 즉시 포인트가 차감됩니다.",
      detail: "DB Function: 포인트 차감 → bets INSERT → debates.pool 업데이트 (원자적 트랜잭션)",
      color: C.green,
    },
    {
      num: "03",
      title: "배당률 실시간 변동",
      desc: "각 진영 풀 비율에 따라 배당률이 실시간으로 변동됩니다. (파리뮤추엘 방식)",
      detail: "payout_ratio = total_pool / winning_side_pool",
      color: C.blue,
    },
    {
      num: "04",
      title: "토론 & 댓글",
      desc: "베팅과 무관하게 댓글 스레드에서 찬/반/중립 입장으로 토론을 펼칩니다.",
      detail: "comments 테이블 — parent_id로 대댓글 지원",
      color: C.textMuted,
    },
    {
      num: "05",
      title: "종료 & 정산",
      desc: "마감일 도래 또는 발제자/현자 투표로 토론을 종료하고 결과를 확정합니다.",
      detail: "Edge Function → 승자 풀에 비례 배분 → point_transactions 기록 → 티어 재계산",
      color: C.red,
    },
    {
      num: "06",
      title: "보상 & 성장",
      desc: "승리 포인트 수령 + XP 획득 → 티어 승급 조건 달성 시 자동 승급, 배지 해금.",
      detail: "profiles.tier 업데이트 → user_badges INSERT (해당 시)",
      color: C.yellow,
    },
  ];

  return (
    <div>
      <p style={{ color: C.textMuted, marginBottom: 24, lineHeight: 1.7, fontSize: "14px" }}>
        핵심 유저 플로우: <strong style={{ color: C.accent }}>토론 생성 → 베팅 → 토론 → 정산 → 성장</strong> 사이클입니다.
      </p>
      <div style={{ position: "relative" }}>
        {/* Vertical line */}
        <div
          style={{
            position: "absolute",
            left: 28,
            top: 20,
            bottom: 20,
            width: 2,
            background: `linear-gradient(to bottom, ${C.accent}, ${C.yellow})`,
            opacity: 0.3,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div
                style={{
                  minWidth: 56,
                  height: 56,
                  background: s.color + "20",
                  border: `2px solid ${s.color}`,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "16px",
                  color: s.color,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {s.num}
              </div>
              <div
                style={{
                  flex: 1,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: "14px 18px",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "15px", color: s.color, marginBottom: 4 }}>
                  {s.title}
                </div>
                <p style={{ color: C.textMuted, fontSize: "13px", margin: "0 0 8px", lineHeight: 1.6 }}>
                  {s.desc}
                </p>
                <div
                  style={{
                    background: C.bg,
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: "12px",
                    fontFamily: "'JetBrains Mono', monospace",
                    color: C.textDim,
                  }}
                >
                  {s.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProjectArchitecture() {
  const [activeTab, setActiveTab] = useState(0);

  const content = [<ERDTab />, <FolderTab />, <TierTab />, <FlowTab />];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: "32px 24px",
        maxWidth: 960,
        margin: "0 auto",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>⚡</span>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 800,
              margin: 0,
              background: `linear-gradient(135deg, ${C.accent}, ${C.blue})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ARENA — 아키텍처 설계서
          </h1>
        </div>
        <p style={{ color: C.textMuted, fontSize: "14px", margin: 0 }}>
          폴리마켓형 예측 투표 × RPG 게이미피케이션 토론 커뮤니티
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 28,
          background: C.surface,
          borderRadius: 10,
          padding: 4,
          border: `1px solid ${C.border}`,
        }}
      >
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              flex: 1,
              padding: "10px 16px",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              transition: "all 0.2s",
              background: activeTab === i ? C.accent : "transparent",
              color: activeTab === i ? "#fff" : C.textMuted,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>{content[activeTab]}</div>
    </div>
  );
}
