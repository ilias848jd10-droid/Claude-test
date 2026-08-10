import { Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import AssetDetail from "./pages/AssetDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/asset/:id" element={<AssetDetail />} />
    </Routes>
  );
}
