import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,

  enabled: process.env.NODE_ENV === "production" && !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,

  // 민감 정보 필터
  beforeSend(event) {
    if (event.user) {
      delete event.user.email
      delete event.user.ip_address
    }
    return event
  },
})
