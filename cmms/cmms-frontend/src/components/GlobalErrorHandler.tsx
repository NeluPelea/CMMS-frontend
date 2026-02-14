import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorHandler extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);

        const chunkFailedMessage = /Loading chunk failed/i;
        if (error && chunkFailedMessage.test(error.message)) {
            window.location.reload();
        }
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-red-500 p-6">
                    <h1 className="text-2xl font-bold mb-4">A apărut o eroare neașteptată.</h1>
                    <p className="mb-6 text-zinc-400">Vă rugăm să reîncărcați pagina.</p>
                    <button
                        className="px-4 py-2 bg-zinc-800 rounded hover:bg-zinc-700 text-white transition-colors"
                        onClick={() => window.location.reload()}
                    >
                        Reîncarcă Aplicația
                    </button>

                    <details className="mt-8 p-4 bg-black/30 rounded text-xs text-left w-full max-w-2xl overflow-auto text-zinc-500">
                        <summary className="cursor-pointer mb-2">Detalii tehnice</summary>
                        {this.state.error && this.state.error.toString()}
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}
