import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useContent } from '../context/ContentContext'

function getInitialTheme() {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const savedTheme = localStorage.getItem('theme')

  if (savedTheme) {
    return savedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme)
  const { language } = useContent()
  const isDark = theme === 'dark'
  const label = isDark
    ? language === 'ky'
      ? 'Жарык теманы күйгүзүү'
      : 'Включить светлую тему'
    : language === 'ky'
      ? 'Караңгы теманы күйгүзүү'
      : 'Включить темную тему'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', theme)
  }, [isDark, theme])

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line/60 bg-panel/60 text-text shadow-soft backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:text-accent"
      aria-label={label}
      title={label}
    >
      {isDark ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  )
}

export default ThemeToggle
