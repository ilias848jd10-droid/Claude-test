import { NavLink } from "react-router-dom";

export default function NavBar() {
  return (
    <nav className="nav-bar">
      <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
        Μετοχές &amp; Κρύπτο
      </NavLink>
      <NavLink to="/derivatives" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
        ETH/USDT Παράγωγα
      </NavLink>
    </nav>
  );
}
