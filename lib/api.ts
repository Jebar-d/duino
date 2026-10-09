export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost/arduino-store/backend";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const isFormData =
    typeof FormData !== "undefined" && options?.body instanceof FormData;
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options?.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new ApiError(
      data.message || "API request failed.",
      response.status,
      data.error_code,
    );
  }

  return data;
}
