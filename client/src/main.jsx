import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './config.js'  // sets axios.defaults.baseURL globally
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
