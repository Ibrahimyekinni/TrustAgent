import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Review from "./pages/Review";
import AgentRegistry from "./pages/AgentRegistry";
import Delegate from "./pages/Delegate";
import Activity from "./pages/Activity";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="agents" element={<AgentRegistry />} />
        <Route path="activity" element={<Activity />} />
        <Route path="review" element={<Review />} />
        <Route path="delegate" element={<Delegate />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
