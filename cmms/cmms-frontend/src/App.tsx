// src/App.tsx
import { Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./RequireAuth";

import LoginPage from "./pages/LoginPage";
import WorkOrdersPage from "./pages/WorkOrdersPage";
import WorkOrderDetailsPage from "./pages/WorkOrderDetailsPage";
import AssetsPage from "./pages/AssetsPage";
import LocationsPage from "./pages/LocationsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/work-orders"
        element={
          <RequireAuth>
            <WorkOrdersPage />
          </RequireAuth>
        }
      />

      <Route
        path="/work-orders/:id"
        element={
          <RequireAuth>
            <WorkOrderDetailsPage />
          </RequireAuth>
        }
      />

      <Route
        path="/assets"
        element={
          <RequireAuth>
            <AssetsPage />
          </RequireAuth>
        }
      />

      <Route
        path="/locations"
        element={
          <RequireAuth>
            <LocationsPage />
          </RequireAuth>
        }
      />

      <Route path="/" element={<Navigate to="/work-orders" replace />} />
      <Route path="*" element={<Navigate to="/work-orders" replace />} />
    </Routes>
  );
}
