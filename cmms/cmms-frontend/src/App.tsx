// src/App.tsx
import { Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./RequireAuth";

import LoginPage from "./pages/LoginPage";
import WorkOrdersPage from "./pages/WorkOrdersPage";
import WorkOrderDetailsPage from "./pages/WorkOrderDetailsPage";
import AssetsPage from "./pages/AssetsPage";
import LocationsPage from "./pages/LocationsPage";
import PmPlansPage from "./pages/PmPlansPage";
import PartsPage from "./pages/PartsPage";
import InventoryPage from "./pages/InventoryPage";
import DashboardPage from "./pages/DashboardPage";

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

      <Route 
         path="/pm-plans" 
         element={
             <RequireAuth>
                <PmPlansPage />
             </RequireAuth>} 
       />

      <Route
          path="/parts"
          element={
            <RequireAuth>
              <PartsPage />
            </RequireAuth>
          }
        />

       <Route
       path="/inventory"
          element={
             <RequireAuth>
              <InventoryPage />
            </RequireAuth>
          }
        /> 

        <Route
        path="/dashboard"
            element={
                <RequireAuth>
                <DashboardPage />
                </RequireAuth>
            }
/>

      <Route path="/" element={<Navigate to="/work-orders" replace />} />
     

      

    </Routes>
  );
}
