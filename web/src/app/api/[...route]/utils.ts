export function createResponse<T>(ok: true, data: T): Response;
export function createResponse(
    ok: false,
    error: string,
    message?: string
): Response;
export function createResponse<T>(
    ok: boolean,
    dataOrError: T | string,
    message?: string
): Response {
    if (ok) {
        return Response.json({
            success: true,
            data: dataOrError,
        });
    }
    return Response.json({
        success: false,
        error: dataOrError,
        message,
    });
}
