import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { Exhibition } from "./pages/Exhibition";
import { Points } from "./pages/Points";
import { PointPage } from "./pages/Point";
import { Admin } from "./pages/Admin";
import { CollectionPage } from "./pages/Collection";
import { HistoryPage } from "./pages/History";
import { FavoritesPage } from "./pages/Favorites";
import { ReconstructionPage } from "./pages/Reconstruction";
import { MapPage } from "./pages/Map";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/reconstruction" element={<ReconstructionPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/admin" element={<Admin section="points" />} />
        <Route path="/admin/map" element={<Admin section="map" />} />
        <Route path="/admin/reviews" element={<Admin section="reviews" />} />
        <Route path="/admin/feedback" element={<Admin section="feedback" />} />
        <Route path="/g/:expoSlug" element={<Exhibition />} />
        <Route path="/g/:expoSlug/points" element={<Points />} />
        <Route path="/g/:expoSlug/p/:pointSlug" element={<PointPage />} />
        <Route path="*" element={<div style={{ padding: 16 }}>404</div>} />
      </Routes>
    </BrowserRouter>
  );
}
