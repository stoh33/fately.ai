import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SajuPage from './SajuPage.tsx'

const pathname = window.location.pathname.replace(/\/+$/, '') || '/'
const RootComponent = pathname === '/saju' ? SajuPage : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>,
)
