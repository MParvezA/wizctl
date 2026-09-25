import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type BulbInfo } from "../lib/api";

export function useBulbList() {
  return useQuery({
    queryKey: ["bulbs"],
    queryFn: api.getBulbs,
    refetchInterval: 5000,
  });
}

export function useRescan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.rescanBulbs,
    onSuccess: (data) => client.setQueryData(["bulbs"], data),
  });
}

export function useAddBulb() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ip: string) => api.addBulb(ip),
    onSuccess: (bulb: BulbInfo) => {
      client.setQueryData<BulbInfo[]>(["bulbs"], (prev) => {
        const existing = prev ?? [];
        return [...existing.filter((b) => b.ip !== bulb.ip), bulb];
      });
    },
  });
}

export function useScenes() {
  return useQuery({
    queryKey: ["scenes"],
    queryFn: api.getScenes,
    staleTime: Infinity,
  });
}
