import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getMe, setImpersonationAuth, logout } from "../api";

export default function ImpersonatePage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        const token = searchParams.get("token");
        if (!token) {
            setErr("Token missing in URL");
            return;
        }

        async function init() {
            try {
                // CRITICAL: Clear ALL auth state before impersonation to prevent localStorage leakage
                logout();

                // Set temporary token to fetch profile
                // We use a dummy user/perms first because getMe will overwrite them
                setImpersonationAuth(token!, { id: "", username: "", displayName: "Impersonation...", roles: [], mustChangePassword: false }, []);

                const { user, permissions } = await getMe();

                // Final save to sessionStorage
                setImpersonationAuth(token!, user, permissions);

                navigate("/");
            } catch (ex: any) {
                setErr(ex.message || "Failed to initialize impersonation session");
            }
        }

        init();
    }, [searchParams, navigate]);

    if (err) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
                <div className="bg-rose-500/10 border border-rose-500/50 p-6 rounded-2xl max-w-md w-full text-center">
                    <h1 className="text-rose-400 font-bold mb-2">Eroare Impersonare</h1>
                    <p className="text-zinc-400 text-sm mb-6">{err}</p>
                    <button
                        onClick={() => navigate("/login")}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-xl text-sm transition"
                    >
                        Înapoi la Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 text-zinc-400">
            <div className="h-12 w-12 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
            <p className="animate-pulse">Se inițializează sesiunea de test...</p>
        </div>
    );
}
