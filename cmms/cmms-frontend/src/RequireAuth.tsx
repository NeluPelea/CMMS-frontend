// src/RequireAuth.tsx
import { Navigate, useLocation } from "react-router-dom";
import { isAuthed } from "./api";

export default function RequireAuth({ children }: { children: React.ReactElement }) {
  const loc = useLocation();
  if (!isAuthed()) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}
