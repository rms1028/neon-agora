"use client"

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react"
import { AlertTriangle, X } from "lucide-react"

type ConfirmOptions = {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "default"
}

type ConfirmContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue>({
  confirm: () => Promise.resolve(false),
})

export function useConfirm() {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setOptions(opts)
    })
  }, [])

  function handleClose(result: boolean) {
    resolveRef.current?.(result)
    resolveRef.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => handleClose(false)}
          />

          {/* dialog */}
          <div className="relative mx-4 w-full max-w-sm animate-in fade-in zoom-in-95 rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
            {/* top neon line */}
            <div
              className={`h-px w-full rounded-t-2xl ${
                options.variant === "danger"
                  ? "bg-gradient-to-r from-transparent via-red-400/70 to-transparent"
                  : "bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent"
              }`}
            />

            <div className="p-6">
              {/* icon + close */}
              <div className="mb-4 flex items-start justify-between">
                <div
                  className={`grid size-10 place-items-center rounded-xl border ${
                    options.variant === "danger"
                      ? "border-red-400/30 bg-red-400/10 text-red-400"
                      : "border-cyan-400/30 bg-cyan-400/10 text-cyan-400"
                  }`}
                >
                  <AlertTriangle className="size-5" />
                </div>
                <button
                  onClick={() => handleClose(false)}
                  className="grid size-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* title */}
              {options.title && (
                <h3 className="mb-1 text-sm font-semibold text-zinc-100">
                  {options.title}
                </h3>
              )}

              {/* message */}
              <p className="text-sm leading-relaxed text-zinc-400">
                {options.message}
              </p>

              {/* buttons */}
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => handleClose(false)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10"
                >
                  {options.cancelText ?? "취소"}
                </button>
                <button
                  onClick={() => handleClose(true)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
                    options.variant === "danger"
                      ? "bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:bg-red-600"
                      : "bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:bg-cyan-400"
                  }`}
                >
                  {options.confirmText ?? "확인"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
