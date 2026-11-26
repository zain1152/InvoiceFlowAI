
import { NavLink } from "react-router-dom";

import {
  LayoutDashboard,
  FileText,
  CheckCircle2,
  Users,
  Settings,
  Upload,
  CreditCard,
} from "lucide-react";

const Sidebar = () => {
  const navigation = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Upload Invoice", path: "/upload", icon: Upload },
    { name: "Invoices", path: "/invoices", icon: FileText },
    {
      name: "Approvals",
      path: "/invoices?status=pending",
      icon: CheckCircle2,
    },
    { name: "Vendors", path: "/vendors", icon: Users },
    { name: "Payments", path: "/payments", icon: CreditCard },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">
          <FileText size={23} />
        </div>

        <div>
          <h2>InvoiceFlow</h2>
          <span>AI WORKSPACE</span>
        </div>
      </div>

      <div className="nav-label">WORKSPACE</div>

      <nav className="navigation">
        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={19} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <NavLink to="/settings" className="nav-item">
          <Settings size={19} />
          <span>Settings</span>
        </NavLink>

        <div className="profile">
          <div className="avatar">IF</div>

          <div>
            <strong>Workspace Admin</strong>
            <span>Administrator</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
