export interface Address {
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  state: string;
  country: string;
}

export interface Customer {
  id: string;
  name: string;
  billingAddress: Address;
  shippingAddress: Address;
  email: string;
  createdAt: number;
  lastModifiedAt: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  createdAt: number;
  lastModifiedAt: number;
}

const now = Date.now();

export const customers: Record<string, Customer> = {
  "11111111-1111-4111-8111-111111111111": {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Ada Lovelace",
    billingAddress: {
      line1: "12 Analytical Engine Way",
      city: "London",
      postalCode: "SW1A 1AA",
      state: "",
      country: "UK"
    },
    shippingAddress: {
      line1: "12 Analytical Engine Way",
      city: "London",
      postalCode: "SW1A 1AA",
      state: "",
      country: "UK"
    },
    email: "ada@example.com",
    createdAt: now,
    lastModifiedAt: now
  },
  "22222222-2222-4222-8222-222222222222": {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Grace Hopper",
    billingAddress: {
      line1: "1 Compiler Ave",
      city: "Arlington",
      postalCode: "22201",
      state: "VA",
      country: "US"
    },
    shippingAddress: {
      line1: "1 Compiler Ave",
      city: "Arlington",
      postalCode: "22201",
      state: "VA",
      country: "US"
    },
    email: "grace@example.com",
    createdAt: now,
    lastModifiedAt: now
  }
};

export const products: Record<string, Product> = {
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa": {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sku: "WIDGET-001",
    name: "Standard Widget",
    description: "A perfectly ordinary widget.",
    price: 25,
    createdAt: now,
    lastModifiedAt: now
  },
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb": {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    sku: "GADGET-002",
    name: "Deluxe Gadget",
    description: "Now with 20% more gadgetry.",
    price: 99.99,
    createdAt: now,
    lastModifiedAt: now
  },
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc": {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    sku: "OUT-OF-STOCK-003",
    name: "Perpetually Backordered Gizmo",
    description: "Used to test shipment failures - the mock shipment carrier always rejects this SKU.",
    price: 15,
    createdAt: now,
    lastModifiedAt: now
  }
};
