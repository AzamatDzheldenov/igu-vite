import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import PageLoader from './components/PageLoader'
import MainLayout from './layouts/MainLayout'

const Admin = lazy(() => import('./pages/Admin'))
const AdminLogin = lazy(() => import('./pages/AdminLogin'))
const About = lazy(() => import('./pages/About'))
const Applicants = lazy(() => import('./pages/Applicants'))
const Contacts = lazy(() => import('./pages/Contacts'))
const Documents = lazy(() => import('./pages/Documents'))
const Gallery = lazy(() => import('./pages/Gallery'))
const Home = lazy(() => import('./pages/Home'))
const News = lazy(() => import('./pages/News'))
const Pck = lazy(() => import('./pages/Pck'))
const Students = lazy(() => import('./pages/Students'))

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/applicants" element={<Applicants />} />
          <Route path="/students" element={<Students />} />
          <Route path="/news" element={<News />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/pck/:slug" element={<Pck />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
