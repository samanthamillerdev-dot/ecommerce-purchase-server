import { getCustomer } from "../external/customersClient";
import { Customer, ExternalApiError } from "../external/types";
import { NotFoundError } from "./errors";

export async function fetchCustomerOrThrow(customerId: string): Promise<Customer> {
  try {
    return await getCustomer(customerId);
  } catch (err) {
    if (err instanceof ExternalApiError && err.status === 404) {
      throw new NotFoundError(`Customer ${customerId} not found`);
    }
    throw err;
  }
}
