import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const isActive = (path) => location.pathname === path;

  // Track screen size
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const navLinksContent = (
    <>
      <Link to="/" className={`nav-link ${isActive("/") ? "nav-link--active" : ""}`} onClick={closeMenu}>
        Home
      </Link>
      <Link to="/search" className={`nav-link ${isActive("/search") ? "nav-link--active" : ""}`} onClick={closeMenu}>
        Search
      </Link>
      <Link to="/agents" className={`nav-link ${isActive("/agents") ? "nav-link--active" : ""}`} onClick={closeMenu}>
        Agents
      </Link>
      <Link to="/review" className={`nav-link ${isActive("/review") ? "nav-link--active" : ""}`} onClick={closeMenu}>
        Leave Review
      </Link>
    </>
  );

  // On mobile, portal the overlay + slide menu to body to escape navbar stacking context
  const mobileMenu = isMobile
    ? createPortal(
        <>
          {menuOpen && <div className="nav-overlay" onClick={closeMenu} />}
          <div className={`nav-links nav-links--mobile ${menuOpen ? "nav-links--open" : ""}`}>
            {navLinksContent}
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <>
      <nav className="navbar">
        <Link to="/" className="nav-logo">
          Trust<span className="nav-logo-accent">Agent</span>
        </Link>

        <button
          className={`hamburger ${menuOpen ? "hamburger--open" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>

        {/* Desktop nav links -- inside navbar for flex layout */}
        {!isMobile && (
          <div className="nav-links">
            {navLinksContent}
          </div>
        )}
      </nav>

      {mobileMenu}
    </>
  );
}
