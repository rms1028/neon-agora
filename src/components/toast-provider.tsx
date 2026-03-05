"use client"

import { createContext, useCallback, useContext, useState } from "react"
import { AlertCircle, CheckCircle, Info, X } from "lucide-react"

type ToastType = "info" | "error" | "success"

type Toast = {
  id: string
  message: string
  type: ToastType
}

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

const ICONS = {
  info: <Info className="size-4 shrink-0 text-cyan-400" />,
  success: <CheckCircle className="size-4 shrink-0 text-emerald-400" />,
  error: <AlertCircle className="size-4 shrink-0 text-red-400" />,
}

const STYLES = {
  info: "border-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.08)]",
  success: "border-emerald-400/30 shadow-[0_0_20px_rgba(52,211,153,0.08)]",
  error: "border-red-400/30 shadow-[0_0_20px_rgba(248,113,113,0.08)]",
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* 토스트 컨테이너 */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex min-w-[260px] max-w-[360px] items-center gap-3 rounded-xl border bg-zinc-950 px-4 py-3 text-sm text-zinc-100 backdrop-blur animate-in slide-in-from-bottom-4 duration-300 ${STYLES[toast.type]}`}
          >
            {ICONS[toast.type]}
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              className="shrink-0 text-zinc-600 transition hover:text-zinc-300"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
