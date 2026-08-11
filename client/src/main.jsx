import React from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.jsx'
import { ToastProvider } from './components/Toast.jsx'
import './index.css'

// Remove the pre-React boot spinner rendered by index.html.
const boot = document.getElementById('boot')
if (boot) {
  boot.style.transition = 'opacity .4s ease'
  boot.style.opacity = '0'
  setTimeout(() => boot.remove(), 420)
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>,
)
