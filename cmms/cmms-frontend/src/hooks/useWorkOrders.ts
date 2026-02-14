import { useCallback, useEffect, useRef, useState } from "react";
import {
    getWorkOrders,
    startWorkOrder,
    stopWorkOrder,
    type WorkOrderDto,
    type WorkOrdersParams
} from "../api";

export function useWorkOrders(initialParams: WorkOrdersParams = {}) {
    const [orders, setOrders] = useState<WorkOrderDto[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Use a ref for params to keep loadOrders reference stable across renders
    const paramsRef = useRef<WorkOrdersParams>(initialParams);

    const loadOrders = useCallback(async (params?: WorkOrdersParams) => {
        setLoading(true);
        setError(null);
        try {
            // Merge new params with current
            const filters = { ...paramsRef.current, ...params };
            paramsRef.current = filters;

            const resp = await getWorkOrders(filters);
            setOrders(resp.items);
            setTotal(resp.total);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Eroare la incarcarea comenzilor");
        } finally {
            setLoading(false);
        }
    }, []); // Stable reference

    // Initial load
    useEffect(() => {
        loadOrders(initialParams);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startOrder = async (id: string) => {
        setError(null);
        try {
            const updated = await startWorkOrder(id);
            // Optimistic update or just replace the item
            setOrders(prev => prev.map(o => o.id === id ? updated : o));
            return updated;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Eroare la pornirea comenzii");
            throw e;
        }
    };

    const stopOrder = async (id: string) => {
        setError(null);
        try {
            const updated = await stopWorkOrder(id);
            setOrders(prev => prev.map(o => o.id === id ? updated : o));
            return updated;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Eroare la oprirea comenzii");
            throw e;
        }
    };

    return {
        orders,
        total,
        loading,
        error,
        loadOrders, // Expose for filter updates
        startOrder,
        stopOrder
    };
}
