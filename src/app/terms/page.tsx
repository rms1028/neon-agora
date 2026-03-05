import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "이용약관 — 네온 아고라",
  description: "네온 아고라 서비스 이용약관",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(800px_circle_at_30%_20%,rgba(34,211,238,0.10),transparent_60%)]" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1 text-xs text-zinc-500 transition hover:text-cyan-300"
        >
          &larr; 네온 아고라로 돌아가기
        </Link>

        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-zinc-50">
          이용약관
        </h1>
        <p className="mb-10 text-sm text-zinc-500">
          최종 수정일: 2025년 3월 1일 &middot; 시행일: 2025년 3월 1일
        </p>

        <article className="space-y-8 text-sm leading-relaxed text-zinc-300">
          <Section title="제1조 (목적)">
            본 약관은 네온 아고라(이하 &quot;서비스&quot;)가 제공하는 온라인 토론
            플랫폼 이용에 관한 기본 사항을 규정합니다.
          </Section>

          <Section title="제2조 (정의)">
            <ol className="list-decimal space-y-1 pl-5">
              <li>&quot;회원&quot;이란 본 서비스에 가입하여 계정을 보유한 자를 말합니다.</li>
              <li>&quot;게시물&quot;이란 토론 스레드, 댓글, 투표 등 회원이 서비스 내에 게시하는 모든 콘텐츠를 말합니다.</li>
              <li>&quot;XP&quot;란 서비스 내 활동에 따라 부여되는 경험치 포인트를 말합니다.</li>
            </ol>
          </Section>

          <Section title="제3조 (약관의 효력 및 변경)">
            <ol className="list-decimal space-y-1 pl-5">
              <li>본 약관은 서비스 화면에 게시하거나 기타 방법으로 회원에게 공지함으로써 효력이 발생합니다.</li>
              <li>서비스는 합리적 사유가 있는 경우 약관을 변경할 수 있으며, 변경 시 최소 7일 전 공지합니다.</li>
              <li>변경된 약관에 동의하지 않는 회원은 탈퇴할 수 있습니다.</li>
            </ol>
          </Section>

          <Section title="제4조 (회원가입 및 계정)">
            <ol className="list-decimal space-y-1 pl-5">
              <li>회원가입은 이메일 인증 또는 소셜 로그인(Google, Kakao)을 통해 완료됩니다.</li>
              <li>회원은 정확하고 최신의 정보를 제공하여야 하며, 타인의 정보를 도용하여서는 안 됩니다.</li>
              <li>계정 보안에 대한 책임은 회원 본인에게 있습니다.</li>
            </ol>
          </Section>

          <Section title="제5조 (서비스 이용)">
            <ol className="list-decimal space-y-1 pl-5">
              <li>회원은 토론 생성, 투표, 댓글 작성, AI 기능 활용 등 서비스가 제공하는 기능을 이용할 수 있습니다.</li>
              <li>XP, 배지, 랭킹 등 게임화 요소는 서비스 내에서만 유효하며 현금 등 재산적 가치로 환전할 수 없습니다.</li>
              <li>서비스는 운영상 필요에 따라 기능을 추가·변경·중단할 수 있습니다.</li>
            </ol>
          </Section>

          <Section title="제6조 (회원의 의무)">
            회원은 다음 행위를 하여서는 안 됩니다:
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>욕설, 비방, 혐오 표현 등 타인의 권리를 침해하는 게시물 작성</li>
              <li>허위 정보 또는 스팸의 반복 게시</li>
              <li>서비스의 정상적 운영을 방해하는 행위 (봇, 자동화 도구 등)</li>
              <li>타인의 계정 도용 또는 개인정보 수집</li>
              <li>관련 법령 및 본 약관에 위반되는 행위</li>
            </ul>
          </Section>

          <Section title="제7조 (게시물 관리)">
            <ol className="list-decimal space-y-1 pl-5">
              <li>게시물의 저작권은 작성자에게 귀속되며, 서비스는 플랫폼 내 전시 목적으로만 이용합니다.</li>
              <li>서비스는 신고된 게시물에 대해 검토 후 삭제·비공개 처리할 수 있습니다.</li>
              <li>관리자는 반복 위반 회원에 대해 서비스 이용을 제한(정지)할 수 있습니다.</li>
            </ol>
          </Section>

          <Section title="제8조 (AI 기능)">
            <ol className="list-decimal space-y-1 pl-5">
              <li>AI 판사, 팩트체크, 코칭 등 AI 기능은 참고 목적으로만 제공됩니다.</li>
              <li>AI 결과는 법적 효력이 없으며, 서비스는 AI 결과의 정확성을 보장하지 않습니다.</li>
              <li>AI 기능 이용 시 XP 요건 등 제한이 적용될 수 있습니다.</li>
            </ol>
          </Section>

          <Section title="제9조 (서비스 중단)">
            서비스는 천재지변, 시스템 장애, 운영상 필요 등 불가피한 사유로 서비스 제공을 일시
            중단할 수 있으며, 사전 공지를 원칙으로 합니다.
          </Section>

          <Section title="제10조 (계정 탈퇴 및 데이터)">
            <ol className="list-decimal space-y-1 pl-5">
              <li>회원은 언제든 설정 페이지에서 계정을 탈퇴할 수 있습니다.</li>
              <li>탈퇴 시 개인정보는 즉시 삭제되며, 작성한 댓글은 &quot;[삭제된 계정]&quot;으로 익명화됩니다.</li>
              <li>탈퇴 전 데이터 내보내기 기능을 통해 본인의 데이터를 다운로드할 수 있습니다.</li>
            </ol>
          </Section>

          <Section title="제11조 (면책)">
            <ol className="list-decimal space-y-1 pl-5">
              <li>서비스는 회원 간 분쟁에 대해 개입하지 않으며 중재 의무를 지지 않습니다.</li>
              <li>서비스는 회원이 게시한 정보의 정확성·신뢰성을 보장하지 않습니다.</li>
              <li>서비스의 무료 제공 부분에 대하여 별도의 서비스 수준(SLA)을 보장하지 않습니다.</li>
            </ol>
          </Section>

          <Section title="제12조 (분쟁 해결)">
            본 약관에 관한 분쟁은 대한민국 법률을 준거법으로 하며, 관할 법원은
            서비스 운영자의 소재지를 관할하는 법원으로 합니다.
          </Section>
        </article>

        <div className="mt-12 border-t border-white/10 pt-6 text-xs text-zinc-600">
          <Link href="/privacy" className="transition hover:text-cyan-300">
            개인정보처리방침 보기 &rarr;
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
