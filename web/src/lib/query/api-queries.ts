import { useMutation, useQuery } from '@tanstack/react-query';
import axios, { type AxiosRequestConfig, isAxiosError } from 'axios';

type ApiResponse<T> = {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
};

async function apiFetch<T>(
    endpoint: string,
    options?: AxiosRequestConfig
): Promise<T> {
    try {
        const config: AxiosRequestConfig = {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 7500,
            ...options,
        };
        const response = await axios(endpoint, config);
        const responseData = response.data as ApiResponse<T>;

        if (!responseData.success) {
            throw new Error(
                responseData.message ||
                    responseData.error ||
                    'An error occurred'
            );
        }
        return responseData.data as T;
    } catch (error) {
        if (isAxiosError(error)) {
            if (error.response) {
                const apiError = error.response.data as ApiResponse<never>;
                throw new Error(
                    apiError.message ||
                        apiError.error ||
                        `Request failed with status ${error.response.status}`
                );
            }
        }
        throw error;
    }
}

export function useApiQuery<T>(
    queryKey: string[],
    endpoint: string,
    options?: {
        enabled?: boolean;
        refetchInterval?: number;
    }
) {
    return useQuery({
        queryKey,
        queryFn: () => apiFetch<T>(endpoint),
        ...options,
    });
}

export function useApiMutation<TData, TVariables>(
    endpoint: string,
    method: 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'POST',
    options?: {
        onSuccess?: (data: TData) => void;
        onError?: (error: Error) => void;
    }
) {
    return useMutation({
        mutationFn: async (variables: TVariables) => {
            return apiFetch<TData>(endpoint, {
                method,
                data: variables,
            });
        },
        ...options,
    });
}

interface PharmacyData {
    city: string;
    district: string;
    name: string;
    phone: string;
    address: string;
    lat: number;
    long: number;
}

export function usePharmacyQuery(enabled = true) {
    return useApiQuery<PharmacyData[]>(['pharmacy'], '/api/pharmacy', {
        refetchInterval: 7200000,
        enabled,
    });
}
