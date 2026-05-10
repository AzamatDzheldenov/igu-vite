import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ContentProvider } from './context/ContentContext.jsx'
import './index.css'
import { normalizeBasePath } from './utils/basePath.js'
import { safeStorage } from './utils/safeStorage.js'

const savedTheme = safeStorage.get('theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
  document.documentElement.classList.add('dark')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={normalizeBasePath(import.meta.env.VITE_BASE_PATH)}>
      <ContentProvider>
        <App />
      </ContentProvider>
    </BrowserRouter>
  </StrictMode>,
)
