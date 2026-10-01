import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import Icon from "./Icon";

const NAV = [
  { id: "compose", label: "Compose", icon: "pen" },
  { id: "drafts", label: "Drafts", icon: "folder" },
  { id: "insights", label: "Insights", icon: "chart" },
];

export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="logo-bg" />
      <path d="M16 16 L27 10.5 A12 12 0 0 0 20 4.7 Z" className="logo-sweep" />
      <circle cx="16" cy="16" r="12" className="logo-ring" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="7" className="logo-ring" strokeWidth="1.2" opacity=".7" />
      <circle cx="21.5" cy="10" r="2.3" className="logo-hot" />
      <circle cx="11.5" cy="21" r="1.9" className="logo-warm" />
    </svg>
  );
}

export default function Header({ route, onNavigate, onSignIn, isDark, onToggleTheme }) {
  const { user, status, accountsAvailable, signOut, deleteAccount } = useAuth();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenu(false);
    };
    const esc = (e) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  return (
    <header className="app-header">
      <a className="brand" href="#/compose" onClick={() => onNavigate("compose")}>
        <Logo />
        <span className="brand-name">Tone Radar</span>
      </a>
      <nav className="nav" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.id} href={`#/${n.id}`} className={`nav-link ${route === n.id ? "on" : ""}`} aria-current={route === n.id ? "page" : undefined}>
            <Icon name={n.icon} size={16} />
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
      <div className="header-right">
        <button className="icon-btn" onClick={onToggleTheme} aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme">
          <Icon name={isDark ? "sun" : "moon"} />
        </button>
        {status === "signedIn" ? (
          <div className="user-menu" ref={menuRef}>
            <button className="avatar" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="Account menu">
              {(user.name || user.email).trim().charAt(0).toUpperCase()}
            </button>
            {menu && (
              <div className="menu" role="menu">
                <div className="menu-head">
                  <strong>{user.name || "Signed in"}</strong>
                  <span className="muted small">{user.email}</span>
                </div>
                <button role="menuitem" onClick={() => { setMenu(false); signOut(); }}>
                  <Icon name="logout" size={15} /> Sign out
                </button>
                <button
                  role="menuitem"
                  className="danger"
                  onClick={async () => {
                    setMenu(false);
                    if (window.confirm("Delete your account, drafts, and insights? This can't be undone.")) await deleteAccount();
                  }}
                >
                  <Icon name="trash" size={15} /> Delete account
                </button>
              </div>
            )}
          </div>
        ) : status === "guest" && accountsAvailable ? (
          <button className="btn btn-sm" onClick={onSignIn}>
            <Icon name="user" size={15} /> Sign in
          </button>
        ) : status === "guest" ? (
          <span className="guest-chip" title="The database isn't connected, so accounts, drafts, and insights are off. Checking messages still works.">
            Guest mode
          </span>
        ) : null}
      </div>
    </header>
  );
}
