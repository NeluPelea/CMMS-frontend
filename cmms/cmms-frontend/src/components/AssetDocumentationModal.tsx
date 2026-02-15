import { useEffect, useState, useCallback } from "react";
import { Button, ErrorBox, Input, FieldLabel, cx, Modal } from "./ui";
import {
    getAssetDocuments,
    uploadAssetDocument,
    updateAssetDocumentTitle,
    deleteAssetDocument,
    fetchAssetDocumentContent,
    type AssetDto,
    type AssetDocumentDto,
} from "../api/assets";
import { hasPerm } from "../api";

// Helper hook for media query
function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const media = window.matchMedia(query);
        if (media.matches !== matches) setMatches(media.matches);
        const listener = () => setMatches(media.matches);
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
    }, [matches, query]);
    return matches;
}

interface AssetDocumentationModalProps {
    asset: AssetDto;
    onClose: () => void;
}

export default function AssetDocumentationModal({ asset, onClose }: AssetDocumentationModalProps) {
    const isMobile = useMediaQuery("(max-width: 1023px)");

    // Default to 'docs' tab
    const [activeTab, setActiveTab] = useState<"docs" | "preview" | "upload">("docs");

    const [docs, setDocs] = useState<AssetDocumentDto[]>([]);
    const [loading, setLoading] = useState(false);

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [isUploadExpanded, setIsUploadExpanded] = useState(false);

    // Preview
    const [previewDoc, setPreviewDoc] = useState<AssetDocumentDto | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Initial Load
    const loadDocs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAssetDocuments(asset.id);
            setDocs(data);
        } catch (e) {
            setErr((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [asset.id]);

    useEffect(() => {
        loadDocs();
    }, [loadDocs]);

    // Cleanup object URL
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    async function onUpload() {
        if (!file || !title.trim()) return;
        setUploading(true);
        setErr(null);
        try {
            await uploadAssetDocument(asset.id, title.trim(), file);
            setTitle("");
            setFile(null);

            // Reset file input
            const fileInput = document.getElementById("doc-file-input") as HTMLInputElement;
            if (fileInput) fileInput.value = "";

            await loadDocs();
            if (isMobile) setActiveTab("docs");
        } catch (e) {
            setErr((e as Error).message || "Upload failed");
        } finally {
            setUploading(false);
        }
    }

    async function onDeleteDoc(docId: string) {
        if (!confirm("Stergeti documentul?")) return;
        try {
            await deleteAssetDocument(asset.id, docId);
            if (previewDoc?.id === docId) {
                setPreviewDoc(null);
                setPreviewUrl(null);
            }
            await loadDocs();
        } catch (e) {
            alert((e as Error).message);
        }
    }

    async function onRename(doc: AssetDocumentDto) {
        const newTitle = prompt("Denumire noua:", doc.title);
        if (!newTitle || newTitle === doc.title) return;
        try {
            await updateAssetDocumentTitle(asset.id, doc.id, newTitle.trim());
            loadDocs();
        } catch (e) {
            alert((e as Error).message);
        }
    }

    async function onPreview(doc: AssetDocumentDto) {
        setPreviewDoc(doc);
        setPreviewUrl(null);
        if (isMobile) setActiveTab("preview");

        try {
            const { blob } = await fetchAssetDocumentContent(asset.id, doc.id, "preview");
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
        } catch (e) {
            alert("Nu s-a putut incarca previzualizarea: " + (e as Error).message);
            setPreviewDoc(null);
        }
    }

    async function onDownload(doc: AssetDocumentDto) {
        try {
            const { blob, fileName } = await fetchAssetDocumentContent(asset.id, doc.id, "download");
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName || doc.fileName || "download";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert("Descarcare esuata: " + (e as Error).message);
        }
    }

    const isImage = (ct: string) => ct.startsWith("image/");
    const isPdf = (ct: string) => ct === "application/pdf";

    return (
        <Modal
            title={`Documentatie: ${asset.name}`}
            onClose={onClose}
            widthClassName={isMobile ? "fixed inset-0 w-full h-full m-0 rounded-none max-w-none bg-zinc-900" : "max-w-6xl w-full h-[90vh]"}
        >
            <div className="flex flex-col h-full bg-zinc-900 overflow-hidden">
                {/* Mobile Tabs */}
                {isMobile && (
                    <div className="flex border-b border-white/10 shrink-0 bg-zinc-900 sticky top-0 z-10">
                        <button onClick={() => setActiveTab("docs")} className={cx("flex-1 py-3 text-sm font-medium transition-colors", activeTab === "docs" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-zinc-400 hover:text-zinc-200")}>Documente</button>
                        <button onClick={() => setActiveTab("preview")} className={cx("flex-1 py-3 text-sm font-medium transition-colors", activeTab === "preview" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-zinc-400 hover:text-zinc-200")}>Preview</button>
                        {hasPerm("ASSET_UPDATE") && (
                            <button onClick={() => setActiveTab("upload")} className={cx("flex-1 py-3 text-sm font-medium transition-colors", activeTab === "upload" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-zinc-400 hover:text-zinc-200")}>Upload</button>
                        )}
                    </div>
                )}

                {/* Main Content - Full Height */}
                <div className="flex-1 overflow-hidden relative">

                    {err && <div className="p-4 shrink-0"><ErrorBox message={err} onClose={() => setErr(null)} /></div>}

                    <div className={cx("h-full w-full", isMobile ? "block" : "grid grid-cols-12 gap-0")}>

                        {/* LEFT RAIL: List + Upload */}
                        <div className={cx(
                            "flex flex-col gap-0 overflow-hidden h-full border-r border-white/10 bg-zinc-900",
                            isMobile ? (activeTab === "docs" || activeTab === "upload" ? "block relative" : "hidden") : "col-span-4 xl:col-span-3"
                        )}>

                            {/* Upload Section */}
                            {hasPerm("ASSET_UPDATE") && (!isMobile || activeTab === "upload") && (
                                <div className="bg-zinc-800/30 border-b border-white/5 shrink-0">
                                    {/* Desktop Accordion Header */}
                                    {!isMobile && (
                                        <button
                                            onClick={() => setIsUploadExpanded(!isUploadExpanded)}
                                            className="w-full flex items-center justify-between p-4 text-sm font-medium text-zinc-300 hover:bg-white/5 transition-colors"
                                        >
                                            <span className="flex items-center gap-2">
                                                <span>📤</span> Incarca document nou
                                            </span>
                                            <span>{isUploadExpanded ? "▲" : "▼"}</span>
                                        </button>
                                    )}

                                    {/* Upload Form */}
                                    {(isMobile || isUploadExpanded) && (
                                        <div className="p-4 space-y-4">
                                            <div>
                                                <FieldLabel>Denumire</FieldLabel>
                                                <Input
                                                    value={title}
                                                    onChange={e => setTitle(e.target.value)}
                                                    placeholder="ex: Manual utilizare"
                                                />
                                            </div>
                                            <div>
                                                <FieldLabel>Fisier</FieldLabel>
                                                <input
                                                    id="doc-file-input"
                                                    type="file"
                                                    className="w-full text-sm text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                                                />
                                            </div>
                                            <Button
                                                variant="primary"
                                                onClick={onUpload}
                                                disabled={!file || !title.trim() || uploading}
                                                className="w-full justify-center"
                                            >
                                                {uploading ? "Se incarca..." : "Incarca"}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Documents List */}
                            {(!isMobile || activeTab === "docs") && (
                                <div className="flex-1 flex flex-col min-h-0 bg-zinc-900">
                                    {loading && <div className="text-sm text-zinc-500 py-8 text-center">Se incarca...</div>}
                                    {!loading && docs.length === 0 && <div className="text-sm text-zinc-500 italic py-8 text-center">Niciun document atasat.</div>}

                                    <div className="flex-1 overflow-y-auto w-full">
                                        {docs.map(doc => (
                                            <div
                                                key={doc.id}
                                                className={cx(
                                                    "p-4 border-b border-white/5 transition-colors cursor-pointer hover:bg-white/5 group",
                                                    previewDoc?.id === doc.id ? "bg-indigo-500/10 border-l-4 border-l-indigo-500" : "border-l-4 border-l-transparent"
                                                )}
                                                onClick={() => onPreview(doc)}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="font-medium text-zinc-200 line-clamp-2 pr-2">{doc.title}</div>
                                                    <div className="text-[10px] text-zinc-500 shrink-0 uppercase tracking-wider">{new Date(doc.createdAt).toLocaleDateString("ro-RO")}</div>
                                                </div>
                                                <div className="flex justify-between items-center text-xs text-zinc-500">
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">{(doc.sizeBytes / 1024).toFixed(0)} KB</span>
                                                    </div>

                                                    {/* Desktop Context Actions */}
                                                    <div className="hidden lg:flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={(e) => { e.stopPropagation(); onDownload(doc); }} title="Download" className="hover:text-white">⬇️</button>
                                                        {hasPerm("ASSET_UPDATE") && (
                                                            <>
                                                                <button onClick={(e) => { e.stopPropagation(); onRename(doc); }} title="Rename" className="hover:text-yellow-400">✏️</button>
                                                                <button onClick={(e) => { e.stopPropagation(); onDeleteDoc(doc.id); }} title="Delete" className="hover:text-red-400">🗑️</button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT MAIN: Preview */}
                        <div className={cx(
                            "flex flex-col h-full bg-zinc-950 overflow-hidden relative",
                            isMobile ? (activeTab === "preview" ? "block absolute inset-0 z-20" : "hidden") : "col-span-8 xl:col-span-9"
                        )}>
                            {/* Preview Content */}
                            <div className="flex-1 relative w-full h-full bg-black/40 flex items-center justify-center">
                                {previewDoc && previewUrl ? (
                                    <>
                                        {isImage(previewDoc.contentType) ? (
                                            <img src={previewUrl} alt={previewDoc.title} className="w-full h-full object-contain" />
                                        ) : isPdf(previewDoc.contentType) ? (
                                            <iframe src={previewUrl} className="w-full h-full border-0 bg-white" title={previewDoc.title} />
                                        ) : (
                                            <div className="text-center p-8">
                                                <p className="text-zinc-500 mb-4">Preview indisponibil pentru acest format.</p>
                                                <Button variant="ghost" onClick={() => onDownload(previewDoc)}>Descarca Fisier</Button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-zinc-700 text-center">
                                        <div className="text-6xl mb-4 opacity-20">📄</div>
                                        <p>Selecteaza un document pentru previzualizare</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Mobile Bottom Action Bar (Sticky) */}
                    {isMobile && activeTab === "preview" && previewDoc && (
                        <div className="bg-zinc-900 border-t border-white/10 p-2 flex justify-around items-center sticky bottom-0 z-30 pb-safe">
                            <button onClick={() => onDownload(previewDoc)} className="flex flex-col items-center gap-1 p-2 text-zinc-400 hover:text-white">
                                <span className="text-xl">⬇️</span>
                                <span className="text-[10px]">Download</span>
                            </button>
                            {hasPerm("ASSET_UPDATE") && (
                                <>
                                    <button onClick={() => onRename(previewDoc)} className="flex flex-col items-center gap-1 p-2 text-zinc-400 hover:text-white">
                                        <span className="text-xl">✏️</span>
                                        <span className="text-[10px]">Redenumeste</span>
                                    </button>
                                    <button onClick={() => onDeleteDoc(previewDoc.id)} className="flex flex-col items-center gap-1 p-2 text-zinc-400 hover:text-red-400">
                                        <span className="text-xl">🗑️</span>
                                        <span className="text-[10px]">Sterge</span>
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
