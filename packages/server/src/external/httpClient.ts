import { ExternalApiError } from "./types";

export async function fetchExternal(url: string, init: RequestInit, serviceName: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new ExternalApiError(`Could not reach the ${serviceName} service`, 503);
  }
}
