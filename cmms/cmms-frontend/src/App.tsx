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
import PeoplePage from "./pages/PeoplePage";
import RolesPage from "./pages/RolesPage";
import CalendarPage from "./pages/CalendarPage";
import ExtraJobsPage from "./pages/ExtraJobsPage";
import WorkOrderPrintPage from "./pages/WorkOrderPrintPage";
import ReportsPage from "./pages/ReportsPage";

export default function App() {
    return (
        <Routes>
            {/* Ruta pentru autentificare */}
            <Route path="/login" element={<LoginPage />} />

            {/* Rute protejate - Mentenanta si Operatiuni */}
            <Route
                path="/dashboard"
                element={
                    <RequireAuth>
                        <DashboardPage />
                    </RequireAuth>
                }
            />
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
                path="/work-orders/:id/print"
                element={
                    <RequireAuth>
                        <WorkOrderPrintPage />
                    </RequireAuth>
                }
            />
            <Route
                path="/calendar"
                element={
                    <RequireAuth>
                        <CalendarPage />
                    </RequireAuth>
                }
            />
            <Route
                path="/extra-jobs"
                element={
                    <RequireAuth>
                        <ExtraJobsPage />
                    </RequireAuth>
                }
            />
            <Route
                path="/pm-plans"
                element={
                    <RequireAuth>
                        <PmPlansPage />
                    </RequireAuth>
                }
            />

            {/* Gestiune Active si Locatii */}
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

            {/* Gestiune Stocuri si Piese */}
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

            {/* Administrare Utilizatori si Roluri */}
            <Route
                path="/people"
                element={
                    <RequireAuth>
                        <PeoplePage />
                    </RequireAuth>
                }
            />
            <Route
                path="/roles"
                element={
                    <RequireAuth>
                        <RolesPage />
                    </RequireAuth>
                }
            />
            <Route
                path="/reports"
                element={
                    <RequireAuth>
                        <ReportsPage />
                    </RequireAuth>
                }
            />

            {/* Redirect de siguranta si ruta principala */}
            <Route path="/" element={<Navigate to="/work-orders" replace />} />
            <Route path="*" element={<Navigate to="/work-orders" replace />} />
        </Routes>
    );
}