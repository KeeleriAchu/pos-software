import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './components/ui/Toast'
import Sidebar from './components/layout/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Billing from './pages/Billing'
import Customers from './pages/Customers'
import Products from './pages/Products'
import Pending from './pages/Pending'
import Reports from './pages/Reports'
import Reminders from './pages/Reminders'
import Settings from './pages/Settings'

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
      <Route path="/billing" element={<ProtectedLayout><Billing /></ProtectedLayout>} />
      <Route path="/customers" element={<ProtectedLayout><Customers /></ProtectedLayout>} />
      <Route path="/products" element={<ProtectedLayout><Products /></ProtectedLayout>} />
      <Route path="/pending" element={<ProtectedLayout><Pending /></ProtectedLayout>} />
      <Route path="/reports" element={<ProtectedLayout><Reports /></ProtectedLayout>} />
      <Route path="/reminders" element={<ProtectedLayout><Reminders /></ProtectedLayout>} />
      <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
