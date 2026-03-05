import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,

  // 프로덕션에서만 활성화
  enabled: process.env.NODE_ENV === "production" && !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 샘플링 비율 (10% — 트래픽에 맞게 조정)
  tracesSampleRate: 0.1,

  // 세션 리플레이 (에러 시에만 캡처)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration(),
  ],

  // 민감 정보 필터
  beforeSend(event) {
    if (event.user) {
      delete event.user.email
      delete event.user.ip_address
    }
    return event
  },
})
