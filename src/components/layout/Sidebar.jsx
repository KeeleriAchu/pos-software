import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Receipt, Users, Clock, BarChart3,
  Package, Settings, LogOut, Bell, ShoppingBag
} from 'lucide-react'
import { signOut } from '../../services/api'
import ThemeToggle from '../ui/ThemeToggle'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/billing', icon: Receipt, label: 'New Bill' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/products', icon: Package, label: 'Products' },
  { to: '/pending', icon: Clock, label: 'Pending' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/reminders', icon: Bell, label: 'Reminders' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark"><ShoppingBag size={22} /></div>
        <div>
          <div className="sidebar-title">POS Manager</div>
          <div className="sidebar-subtitle">Smart Billing</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        {navItems.slice(0, 5).map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}

        <div className="nav-section-label" style={{ marginTop: 8 }}>Analytics</div>
        {navItems.slice(5).map(({ to, icon: Icon, label }) => (
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
