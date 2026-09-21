import { useQuery } from "@tanstack/react-query";

import { boardApi, registrationApi, userApi } from "../services/api";
import { useUserStore } from "../stores/userStore";

export function useBoardsQuery() {
  return useQuery({
    queryKey: ["boards"],
    queryFn: boardApi.getBoards,
    retry: false,
  });
}

export function useMeQuery() {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ["me"],
    queryFn: userApi.getMe,
    enabled: isAuthenticated,
    retry: false,
  });
}

export function useRegistrationOptionsQuery() {
  return useQuery({
    queryKey: ["registration-options"],
    queryFn: registrationApi.getOptions,
    staleTime: 60_000,
  });
}
