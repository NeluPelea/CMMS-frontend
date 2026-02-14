import { useState, useCallback, useMemo } from 'react';
import { getWorkOrders, type WorkOrderDto, type WorkOrdersParams } from '../api/workOrders';
import { WorkOrderType } from '../domain/enums';

export interface ReportFilters {
    startDate: string;
    endDate: string;
    type: 'All' | 'PM' | 'Corrective';
}

export interface ReportKpis {
    totalCost: number;
    totalHours: number;
    interventionCount: number;
}

export function useReports() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<WorkOrderDto[]>([]);

    // Default to current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = now.toISOString().split('T')[0];

    const [filters, setFilters] = useState<ReportFilters>({
        startDate: startOfMonth,
        endDate: endOfMonth,
        type: 'All'
    });

    const generateReport = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: WorkOrdersParams = {
                from: filters.startDate ? `${filters.startDate}T00:00:00Z` : undefined,
                to: filters.endDate ? `${filters.endDate}T23:59:59Z` : undefined,
                take: 1000, // Large enough for report
            };

            if (filters.type === 'PM') {
                params.type = WorkOrderType.Preventive;
            } else if (filters.type === 'Corrective') {
                params.type = WorkOrderType.Corrective;
            }

            const resp = await getWorkOrders(params);
            setData(resp.items);
        } catch (e: any) {
            setError(e.message || 'Eroare la generarea raportului');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    const kpis = useMemo<ReportKpis>(() => {
        const interventionCount = data.length;
        const totalMinutes = data.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);
        const totalHours = totalMinutes / 60;

        // Estimate cost: 100 RON/hour for labor + placeholder for parts
        // Ideally we would fetch actual costs from the DB, but for now we calculate an estimate
        const laborRate = 100;
        const totalCost = totalHours * laborRate;

        return {
            totalCost,
            totalHours,
            interventionCount
        };
    }, [data]);

    const reportRows = useMemo(() => {
        return data.map(wo => ({
            date: wo.startAt ? new Date(wo.startAt).toLocaleDateString('ro-RO') : '-',
            title: wo.title,
            assetName: wo.asset?.name || '-',
            cost: `${((wo.durationMinutes || 0) / 60 * 100).toFixed(0)} RON`, // Estimated
            duration: `${wo.durationMinutes || 0} min`,
            id: wo.id
        }));
    }, [data]);

    return {
        filters,
        setFilters,
        loading,
        error,
        data,
        kpis,
        reportRows,
        generateReport
    };
}
