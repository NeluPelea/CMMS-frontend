// src/RequirePermission.tsx
import type { ReactElement } from "react";
import { hasPerm } from "./api";

import AccessDeniedPage from "./pages/AccessDeniedPage";

interface Props {
    permission: string;
    children: ReactElement;
    fallback?: ReactElement;
}

export default function RequirePermission({ permission, children, fallback }: Props) {
    if (!hasPerm(permission)) {
        return fallback || <AccessDeniedPage />;
    }
    return children;
}
