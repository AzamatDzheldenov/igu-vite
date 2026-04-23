import { Menu, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import logo from '../assets/logo.png'
import { useContent } from '../context/ContentContext'
import LanguageToggle from './LanguageToggle'
import NavBar from './NavBar'
import ThemeToggle from './ThemeToggle'

function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()
  const menuId = useId()
  const { language } = useContent()

  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-2 pt-2 sm:px-6 sm:pt-4">
      <div className="glass-panel mx-auto w-full max-w-[96rem] rounded-[20px] px-3 py-3 sm:rounded-[25px] sm:px-4 sm:py-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
          <Link
            to="/"
            aria-label={language === 'ky' ? 'Башкы бетке өтүү' : 'На главную'}
            className="focus-ring flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-text"
            onClick={() => setIsOpen(false)}
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-soft sm:h-16 sm:w-16">
              <img src={logo} alt="" className="h-full w-full object-contain" />
            </span>
          </Link>

          <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
            <NavBar />
            <LanguageToggle />
            <ThemeToggle />
            <button
              type="button"
              className="focus-ring inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line/60 bg-panel/60 text-text shadow-soft backdrop-blur-xl transition duration-300 hover:border-accent/40 hover:text-accent lg:hidden"
              onClick={() => setIsOpen((value) => !value)}
              aria-label={
                isOpen
                  ? language === 'ky'
                    ? 'Менюну жабуу'
                    : 'Закрыть меню'
                  : language === 'ky'
                    ? 'Менюну ачуу'
                    : 'Открыть меню'
              }
              aria-expanded={isOpen}
              aria-controls={menuId}
            >
              {isOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>

        <div
          id={menuId}
          aria-hidden={!isOpen}
          className={[
            'grid overflow-hidden transition-all duration-300 lg:hidden',
            isOpen
              ? 'grid-rows-[1fr] pt-3 opacity-100'
              : 'pointer-events-none grid-rows-[0fr] opacity-0',
          ].join(' ')}
        >
          <div className="min-h-0">
            <div className="rounded-lg border border-line/50 bg-panel/50 p-2 backdrop-blur-2xl">
              <NavBar mobile onNavigate={() => setIsOpen(false)} />
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
