import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function Layout() {
  return (
    <>
      {/* Animated background */}
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-orb bg-orb--1" aria-hidden="true" />
      <div className="bg-orb bg-orb--2" aria-hidden="true" />
      <div className="bg-orb bg-orb--3" aria-hidden="true" />

      <Navbar />

      <main>
        <Outlet />
      </main>

      <Footer />
    </>
  );
}
