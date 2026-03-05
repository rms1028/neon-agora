"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"

type Theme = "dark" | "light"

type ThemeContextType = {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")

  // 초기 로드: localStorage에서 테마 복원
  useEffect(() => {
    const stored = localStorage.getItem("neon-agora-theme") as Theme | null
    if (stored === "light" || stored === "dark") {
      setTheme(stored)
      document.documentElement.setAttribute("data-theme", stored)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark"
      localStorage.setItem("neon-agora-theme", next)
      document.documentElement.setAttribute("data-theme", next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
