import { useNavigate } from "react-router-dom";

export default function AccessDeniedPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
            <div className="bg-rose-500/10 p-4 rounded-full mb-6 text-rose-500">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-12 h-12"
                >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
            </div>

            <h1 className="text-3xl font-bold text-white mb-2">Acces Restricționat</h1>
            <p className="text-zinc-400 max-w-md mb-8">
                Nu aveți permisiunile necesare pentru a accesa această pagină.
                Dacă credeți că este o eroare, contactați administratorul sistemului.
            </p>

            <button
                onClick={() => navigate("/")}
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-xl transition font-medium border border-zinc-700 hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500 ring-offset-2 ring-offset-zinc-900"
            >
                Înapoi la Dashboard
            </button>
        </div>
    );
}
