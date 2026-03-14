import { Link, useLocation } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <Link to="/" className="nav-logo">
        Trust<span className="nav-logo-accent">Agent</span>
      </Link>
      <div className="nav-links">
        <Link to="/" className={`nav-link ${isActive("/") ? "nav-link--active" : ""}`}>
          Home
        </Link>
        <Link to="/search" className={`nav-link ${isActive("/search") ? "nav-link--active" : ""}`}>
          Search
        </Link>
        <Link to="/review" className={`nav-link ${isActive("/review") ? "nav-link--active" : ""}`}>
          Leave Review
        </Link>
      </div>
    </nav>
  );
}
