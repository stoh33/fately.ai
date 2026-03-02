import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './pages/AppPage.tsx'
import SajuPage from './pages/SajuPage.tsx'

const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
const RootComponent = pathname === '/saju' ? SajuPage : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>,
)
