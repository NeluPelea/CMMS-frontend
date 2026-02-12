// src/RequirePermission.tsx
import type { ReactElement } from "react";
import { hasPerm } from "./api";

interface Props {
    permission: string;
    children: ReactElement;
    fallback?: ReactElement;
}

export default function RequirePermission({ permission, children, fallback }: Props) {
    if (!hasPerm(permission)) {
        return fallback || (
            <div style={{ padding: 40, textAlign: "center" }}>
                <h2>Acces interzis</h2>
                <p>Nu aveți permisiunea necesară pentru a accesa această pagină ({permission}).</p>
            </div>
        );
    }
    return children;
}
