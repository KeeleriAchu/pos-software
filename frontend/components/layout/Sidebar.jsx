import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, Users, Clock, BarChart3,
  Package, Settings, LogOut, Bell, ShoppingBag
} from 'lucide-react'
import { signOut } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import ThemeToggle from '../ui/ThemeToggle'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', role: 'all' },
  { to: '/billing', icon: Receipt, label: 'New Bill', role: 'all' },
  { to: '/customers', icon: Users, label: 'Customers', role: 'all' },
  { to: '/products', icon: Package, label: 'Products', role: 'admin' },
  { to: '/pending', icon: Clock, label: 'Pending', role: 'all' },
  { to: '/reports', icon: BarChart3, label: 'Reports', role: 'admin' },
  { to: '/reminders', icon: Bell, label: 'Reminders', role: 'all' },
  { to: '/settings', icon: Settings, label: 'Settings', role: 'admin' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark"><ShoppingBag size={22} /></div>
        <div>
          <div className="sidebar-title">SHOPPING POINT</div>
          <div className="sidebar-subtitle">Smart Billing</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        {navItems.slice(0, 5).filter(item => item.role === 'all' || user?.role === 'admin').map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}

        <div className="nav-section-label" style={{ marginTop: 8 }}>Analytics</div>
        {navItems.slice(5).filter(item => item.role === 'all' || user?.role === 'admin').map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
        <ThemeToggle compact className="sidebar-mobile-theme" />
      </nav>

      <div className="sidebar-footer">
        <ThemeToggle className="sidebar-footer-theme" />
        <div className="sidebar-session">
          <span>Store Desk</span>
          <strong>Live session</strong>
        </div>
        <button className="nav-item nav-logout" onClick={handleLogout}>
          <LogOut size={17} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
