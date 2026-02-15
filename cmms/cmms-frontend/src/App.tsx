// src/App.tsx
import { Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./RequireAuth";
import RequirePermission from "./RequirePermission";

import LoginPage from "./pages/LoginPage";
import WorkOrdersPage from "./pages/WorkOrdersPage";
import WorkOrderDetailsPage from "./pages/WorkOrderDetailsPage";
import WorkOrderCardsPage from "./pages/WorkOrderCardsPage";
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
import SettingsPage from "./pages/SettingsPage";
import AiCopilotPage from "./pages/AiCopilotPage";
import SecurityUsersPage from "./pages/SecurityUsersPage";
import SecurityRolesPage from "./pages/SecurityRolesPage";
import NcListPage from "./pages/NcListPage";
import NcDetailsPage from "./pages/NcDetailsPage";
import SuppliersPage from "./pages/SuppliersPage";
import GoodsReceiptsPage from "./pages/GoodsReceiptsPage";
import GoodsReceiptDetailsPage from "./pages/GoodsReceiptDetailsPage";
import ProcurementPage from "./pages/ProcurementPage";
import ImpersonatePage from "./pages/ImpersonatePage";
import AssetDocumentsPage from "./pages/AssetDocumentsPage";

export default function App() {
    return (
        <Routes>
            {/* Ruta pentru autentificare */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/impersonate" element={<ImpersonatePage />} />

            {/* Rute protejate - Mentenanta si Operatiuni */}
            <Route
                path="/dashboard"
                element={
                    <RequireAuth>
                        <RequirePermission permission="DASHBOARD_VIEW">
                            <DashboardPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/work-orders"
                element={
                    <RequireAuth>
                        <RequirePermission permission="WO_READ">
                            <WorkOrdersPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/work-orders/cards"
                element={
                    <RequireAuth>
                        <RequirePermission permission="WO_READ">
                            <WorkOrderCardsPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/work-orders/:id"
                element={
                    <RequireAuth>
                        <RequirePermission permission="WO_READ">
                            <WorkOrderDetailsPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/work-orders/:id/print"
                element={
                    <RequireAuth>
                        <RequirePermission permission="WO_READ">
                            <WorkOrderPrintPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/calendar"
                element={
                    <RequireAuth>
                        <RequirePermission permission="CALENDAR_READ">
                            <CalendarPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/extra-jobs"
                element={
                    <RequireAuth>
                        <RequirePermission permission="EXTRA_READ">
                            <ExtraJobsPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/pm-plans"
                element={
                    <RequireAuth>
                        <RequirePermission permission="PM_READ">
                            <PmPlansPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />

            {/* Gestiune Active si Locatii */}
            <Route
                path="/assets"
                element={
                    <RequireAuth>
                        <RequirePermission permission="ASSET_READ">
                            <AssetsPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/locations"
                element={
                    <RequireAuth>
                        <RequirePermission permission="LOC_READ">
                            <LocationsPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />



            {/* Gestiune Stocuri si Piese */}
            <Route
                path="/procurement"
                element={
                    <RequireAuth>
                        <RequirePermission permission="INV_READ">
                            <ProcurementPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/parts"
                element={
                    <RequireAuth>
                        <RequirePermission permission="PART_READ">
                            <PartsPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/inventory"
                element={
                    <RequireAuth>
                        <RequirePermission permission="INV_READ">
                            <InventoryPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/goods-receipts"
                element={
                    <RequireAuth>
                        <RequirePermission permission="INV_READ">
                            <GoodsReceiptsPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/goods-receipts/:id"
                element={
                    <RequireAuth>
                        <RequirePermission permission="INV_READ">
                            <GoodsReceiptDetailsPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/suppliers"
                element={
                    <RequireAuth>
                        <RequirePermission permission="SUPPLIERS_READ">
                            <SuppliersPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />

            {/* Note de Comandă */}
            <Route
                path="/nc"
                element={
                    <RequireAuth>
                        <RequirePermission permission="NC_READ">
                            <NcListPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/nc/:id"
                element={
                    <RequireAuth>
                        <RequirePermission permission="NC_READ">
                            <NcDetailsPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />

            {/* Administrare Utilizatori si Roluri */}
            <Route
                path="/people"
                element={
                    <RequireAuth>
                        <RequirePermission permission="PEOPLE_READ">
                            <PeoplePage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/roles"
                element={
                    <RequireAuth>
                        <RequirePermission permission="SETTINGS_READ">
                            <RolesPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />

            {/* Securitate si Admin (Prompt 3) */}
            <Route
                path="/security/users"
                element={
                    <RequireAuth>
                        <RequirePermission permission="SECURITY_USERS_READ">
                            <SecurityUsersPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/security/roles"
                element={
                    <RequireAuth>
                        <RequirePermission permission="SECURITY_ROLES_READ">
                            <SecurityRolesPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />

            <Route
                path="/reports"
                element={
                    <RequireAuth>
                        <RequirePermission permission="REPORTS_VIEW">
                            <ReportsPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/settings"
                element={
                    <RequireAuth>
                        <RequirePermission permission="SETTINGS_READ">
                            <SettingsPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />
            <Route
                path="/ai-copilot"
                element={
                    <RequireAuth>
                        <RequirePermission permission="AI_COPILOT_VIEW">
                            <AiCopilotPage />
                        </RequirePermission>
                    </RequireAuth>
                }
            />

            {/* Redirect de siguranta si ruta principala */}
            <Route path="/" element={<Navigate to="/work-orders" replace />} />
            <Route path="*" element={<Navigate to="/work-orders" replace />} />
        </Routes>
    );
}