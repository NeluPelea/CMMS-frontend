import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getParts, createPart, updatePart, setPartStatus, type GetPartsParams, type CreatePartReq, type UpdatePartReq } from "../api/parts";

export const PARTS_KEY = "parts";

export function useParts(params?: GetPartsParams) {
    return useQuery({
        queryKey: [PARTS_KEY, params],
        queryFn: () => getParts(params),
    });
}

export function useCreatePart() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (req: CreatePartReq) => createPart(req),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PARTS_KEY] });
        },
    });
}

export function useUpdatePart() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, req }: { id: string; req: UpdatePartReq }) => updatePart(id, req),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PARTS_KEY] });
        },
    });
}

export function useSetPartStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setPartStatus(id, isActive),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [PARTS_KEY] });
        },
    });
}
