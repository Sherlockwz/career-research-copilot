import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/styles/global.css'
import { SidePanel } from './SidePanel'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>
)
