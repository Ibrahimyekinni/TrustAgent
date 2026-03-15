import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Review from "./pages/Review";
import AgentRegistry from "./pages/AgentRegistry";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="agents" element={<AgentRegistry />} />
        <Route path="review" element={<Review />} />
      </Route>
    </Routes>
  );
}
