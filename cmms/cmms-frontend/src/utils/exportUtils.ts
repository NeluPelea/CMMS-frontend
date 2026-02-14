import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Restored PDF/Excel export as dependencies are installed.
 */

/**
 * Exports data to an Excel file (.xlsx)
 * @param data Array of objects (flattened)
 * @param fileName Name of the file (without extension)
 */
export function exportToExcel(data: any[], fileName: string) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Raport");

    // Clean filename and ensure extension
    const cleanName = fileName.replace(/[/\\?%*:|"<>]/g, '-');
    XLSX.writeFile(workbook, `${cleanName}.xlsx`);
}

/**
 * Exports data to a PDF file (.pdf)
 * @param headers Array of column keys/labels
 * @param data Array of objects
 * @param title Report Title
 */
export function exportToPDF(headers: { key: string; label: string }[], data: any[], title: string) {
    const doc = new jsPDF('landscape');

    // Add title
    doc.setFontSize(18);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generat la: ${new Date().toLocaleString('ro-RO')}`, 14, 28);

    const tableHeaders = headers.map(h => h.label);
    const tableData = data.map(item => headers.map(h => {
        const val = item[h.key];
        return val === null || val === undefined ? '-' : String(val);
    }));

    autoTable(doc, {
        startY: 35,
        head: [tableHeaders],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [45, 45, 45] },
        styles: { fontSize: 8, cellPadding: 2 },
    });

    const cleanName = title.replace(/[/\\?%*:|"<>]/g, '-');
    doc.save(`${cleanName}.pdf`);
}

/**
 * Helper to flatten objects for export
 * Transforms { asset: { name: 'X' } } into { assetName: 'X' }
 */
export function flattenReportData(data: any[]): any[] {
    return data.map(item => {
        const flattened: any = {};

        const walk = (obj: any, prefix = '') => {
            for (const key in obj) {
                const value = obj[key];
                const newKey = prefix ? `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}` : key;

                if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                    walk(value, newKey);
                } else {
                    flattened[newKey] = value;
                }
            }
        };

        walk(item);
        return flattened;
    });
}
