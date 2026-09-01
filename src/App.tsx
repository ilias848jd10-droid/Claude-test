import { Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";
import Dashboard from "./pages/Dashboard";
import AssetDetail from "./pages/AssetDetail";
import Derivatives from "./pages/Derivatives";
import Kino from "./pages/Kino";

export default function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/asset/:id" element={<AssetDetail />} />
        <Route path="/derivatives" element={<Derivatives />} />
        <Route path="/kino" element={<Kino />} />
      </Routes>
    </>
  );
}
