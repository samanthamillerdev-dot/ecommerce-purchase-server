import { config } from "../config";
import { CreateShipmentRequest, CreateShipmentResponse, ExternalApiError } from "./types";

export async function createShipment(request: CreateShipmentRequest): Promise<CreateShipmentResponse> {
  const res = await fetch(`${config.shipmentsApiBaseUrl}/shipments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request)
  });
  if (!res.ok) {
    let message = `Failed to create shipment (status ${res.status})`;
    try {
      const body = (await res.json()) as { Message?: string };
      if (body.Message) message = body.Message;
    } catch {
      // response wasn't JSON - fall back to the generic message above
    }
    throw new ExternalApiError(message, res.status);
  }
  return (await res.json()) as CreateShipmentResponse;
}
