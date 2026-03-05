import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "개인정보처리방침 — 네온 아고라",
  description: "네온 아고라 개인정보 수집 및 이용에 관한 방침",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(800px_circle_at_70%_20%,rgba(139,92,246,0.10),transparent_60%)]" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1 text-xs text-zinc-500 transition hover:text-violet-300"
        >
          &larr; 네온 아고라로 돌아가기
        </Link>

        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-zinc-50">
          개인정보처리방침
        </h1>
        <p className="mb-10 text-sm text-zinc-500">
          최종 수정일: 2025년 3월 1일 &middot; 시행일: 2025년 3월 1일
        </p>

        <article className="space-y-8 text-sm leading-relaxed text-zinc-300">
          <Section title="1. 개인정보의 수집 항목 및 목적">
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-left text-zinc-400">
                  <th className="py-2 pr-4">수집 항목</th>
                  <th className="py-2 pr-4">수집 목적</th>
                  <th className="py-2">보유 기간</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">이메일 주소</td>
                  <td className="py-2 pr-4">회원가입, 본인 확인, 비밀번호 재설정</td>
                  <td className="py-2">탈퇴 시 즉시 삭제</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">닉네임, 자기소개, 프로필 이미지 URL</td>
                  <td className="py-2 pr-4">서비스 내 프로필 표시</td>
                  <td className="py-2">탈퇴 시 즉시 삭제</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">소셜 로그인 식별자 (Google/Kakao)</td>
                  <td className="py-2 pr-4">간편 로그인</td>
                  <td className="py-2">탈퇴 시 즉시 삭제</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">서비스 이용 기록 (투표, 댓글, XP)</td>
                  <td className="py-2 pr-4">서비스 제공, 랭킹, 업적 시스템</td>
                  <td className="py-2">탈퇴 시 익명화 처리</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">접속 IP, 접속 시간</td>
                  <td className="py-2 pr-4">부정 이용 방지, 보안</td>
                  <td className="py-2">3개월 후 삭제</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section title="2. 개인정보의 수집 방법">
            <ul className="list-disc space-y-1 pl-5">
              <li>회원가입 시 직접 입력</li>
              <li>소셜 로그인 시 제공자로부터 수신</li>
              <li>서비스 이용 과정에서 자동 생성 (접속 로그, 쿠키 등)</li>
            </ul>
          </Section>

          <Section title="3. 개인정보의 제3자 제공">
            서비스는 원칙적으로 회원의 개인정보를 제3자에게 제공하지 않습니다.
            다만, 다음의 경우 예외로 합니다:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>회원이 사전에 동의한 경우</li>
              <li>법령에 의하여 의무가 있는 경우</li>
            </ul>
          </Section>

          <Section title="4. 개인정보 처리 위탁">
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-left text-zinc-400">
                  <th className="py-2 pr-4">수탁사</th>
                  <th className="py-2 pr-4">위탁 업무</th>
                  <th className="py-2">보유 기간</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">Supabase Inc.</td>
                  <td className="py-2 pr-4">데이터베이스 호스팅, 인증</td>
                  <td className="py-2">서비스 이용 기간</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">Vercel Inc.</td>
                  <td className="py-2 pr-4">웹 호스팅, CDN</td>
                  <td className="py-2">서비스 이용 기간</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4">Anthropic PBC</td>
                  <td className="py-2 pr-4">AI 판사 기능 (토론 내용 분석)</td>
                  <td className="py-2">API 호출 시 일시적</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Google LLC</td>
                  <td className="py-2 pr-4">AI 팩트체크, 코칭, 감성 분석</td>
                  <td className="py-2">API 호출 시 일시적</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section title="5. 회원의 권리 및 행사 방법">
            회원은 다음의 권리를 행사할 수 있습니다:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-zinc-100">열람권:</strong> 설정 &gt; 계정에서
                수집된 개인정보를 확인할 수 있습니다.
              </li>
              <li>
                <strong className="text-zinc-100">이동권:</strong> 설정 &gt; 계정에서
                &quot;데이터 내보내기&quot;를 통해 모든 데이터를 JSON 형식으로
                다운로드할 수 있습니다.
              </li>
              <li>
                <strong className="text-zinc-100">삭제권:</strong> 설정 &gt; 계정에서
                &quot;계정 삭제&quot;를 통해 모든 개인정보를 삭제할 수 있습니다.
              </li>
              <li>
                <strong className="text-zinc-100">정정권:</strong> 설정 &gt;
                프로필에서 닉네임, 자기소개 등을 수정할 수 있습니다.
              </li>
            </ul>
          </Section>

          <Section title="6. 쿠키(Cookie) 사용">
            <ul className="list-disc space-y-1 pl-5">
              <li>서비스는 로그인 상태 유지를 위한 인증 쿠키(neon_auth)를 사용합니다.</li>
              <li>다크/라이트 모드 설정은 localStorage에 저장됩니다.</li>
              <li>현재 광고·분석 목적의 제3자 쿠키는 사용하지 않습니다.</li>
            </ul>
          </Section>

          <Section title="7. 개인정보의 파기">
            <ul className="list-disc space-y-1 pl-5">
              <li>회원 탈퇴 시 이메일, 닉네임, 프로필 정보는 즉시 삭제됩니다.</li>
              <li>작성한 댓글은 &quot;[삭제된 계정]&quot;으로 익명화하여 토론 맥락을 보존합니다.</li>
              <li>접속 로그는 수집일로부터 3개월 후 자동 삭제됩니다.</li>
            </ul>
          </Section>

          <Section title="8. 개인정보의 안전성 확보 조치">
            <ul className="list-disc space-y-1 pl-5">
              <li>비밀번호 암호화 저장 (Supabase Auth — bcrypt)</li>
              <li>HTTPS/TLS를 통한 데이터 전송 암호화</li>
              <li>Row Level Security(RLS)를 통한 데이터베이스 접근 통제</li>
              <li>API Rate Limiting을 통한 비정상 접근 차단</li>
              <li>관리자 접근에 대한 추가 인증 및 감사 로그</li>
            </ul>
          </Section>

          <Section title="9. 개인정보 보호 책임자">
            <ul className="list-disc space-y-1 pl-5">
              <li>서비스명: 네온 아고라</li>
              <li>문의: 서비스 내 신고 기능 또는 관리자 페이지를 이용해 주세요.</li>
            </ul>
          </Section>

          <Section title="10. 고지 의무">
            본 방침이 변경될 경우 시행 7일 전에 서비스 공지사항을 통해 알려드리겠습니다.
          </Section>
        </article>

        <div className="mt-12 border-t border-white/10 pt-6 text-xs text-zinc-600">
          <Link href="/terms" className="transition hover:text-violet-300">
            이용약관 보기 &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-2 text-base font-bold text-zinc-100">{title}</h2>
      <div>{children}</div>
    </section>
  )
}
