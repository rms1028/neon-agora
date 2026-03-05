"use client"

import { AuthProvider } from "@/components/auth-provider"
import { ToastProvider } from "@/components/toast-provider"
import { ProfileProvider } from "@/components/profile-provider"
import { NotificationProvider } from "@/components/notification-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { LevelUpOverlay, NumericLevelUpOverlay } from "@/components/level-up-overlay"
import { ConfirmProvider } from "@/components/confirm-dialog"
import { MobileNav } from "@/components/mobile-nav"
import { DebateRequestToast } from "@/components/debate-request-toast"
import { OnboardingModal } from "@/components/onboarding-modal"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <ProfileProvider>
              <NotificationProvider>
                {children}
                <LevelUpOverlay />
                <NumericLevelUpOverlay />
                <DebateRequestToast />
                <OnboardingModal />
                <MobileNav />
              </NotificationProvider>
            </ProfileProvider>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
