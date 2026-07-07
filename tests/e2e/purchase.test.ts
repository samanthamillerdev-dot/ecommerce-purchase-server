import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RunningStack, startStack } from "./testServer";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";
const WIDGET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; // WIDGET-001, price 25
const GADGET_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"; // GADGET-002, price 99.99
const UNSHIPPABLE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"; // shipment always fails

let stack: RunningStack;

beforeAll(async () => {
  stack = await startStack();
}, 20_000);

afterAll(async () => {
  await stack.stop();
});

function api() {
  return request(stack.serverBaseUrl);
}

describe("credit balance", () => {
  it("starts at zero and reflects grants/deducts", async () => {
    await api().get(`/customers/${CUSTOMER_ID}/credit`).expect(200, { customerId: CUSTOMER_ID, balance: 0 });

    await api().post(`/customers/${CUSTOMER_ID}/credit/grant`).send({ amount: 100, reason: "welcome bonus" }).expect(200);

    await api().get(`/customers/${CUSTOMER_ID}/credit`).expect(200, { customerId: CUSTOMER_ID, balance: 100 });

    await api().post(`/customers/${CUSTOMER_ID}/credit/deduct`).send({ amount: 40, reason: "manual adjustment" }).expect(200);

    await api().get(`/customers/${CUSTOMER_ID}/credit`).expect(200, { customerId: CUSTOMER_ID, balance: 60 });
  });

  it("rejects deducting more than the balance", async () => {
    const res = await api().post(`/customers/${CUSTOMER_ID}/credit/deduct`).send({ amount: 999999, reason: "too much" });
    expect(res.status).toBe(400);
  });

  it("404s for a customer the external API doesn't know about", async () => {
    await api().get("/customers/unknown-customer/credit").expect(404);
  });
});

describe("purchase flow", () => {
  it("purchases a product, ships it, and deducts credit", async () => {
    await api().post(`/customers/${OTHER_CUSTOMER_ID}/credit/grant`).send({ amount: 500, reason: "seed" });

    const res = await api()
      .post("/purchases")
      .send({ customerId: OTHER_CUSTOMER_ID, productId: WIDGET_ID, quantity: 2 })
      .expect(201);

    expect(res.body).toMatchObject({
      customerId: OTHER_CUSTOMER_ID,
      sku: "WIDGET-001",
      quantity: 2,
      totalPrice: 50,
      status: "COMPLETED"
    });
    expect(res.body.shipmentId).toBeTruthy();

    await api().get(`/customers/${OTHER_CUSTOMER_ID}/credit`).expect(200, { customerId: OTHER_CUSTOMER_ID, balance: 450 });

    const purchases = await api().get(`/customers/${OTHER_CUSTOMER_ID}/purchases`).expect(200);
    expect(purchases.body).toHaveLength(1);
  });

  it("rejects a purchase when the customer has insufficient credit", async () => {
    const res = await api().post("/purchases").send({ customerId: OTHER_CUSTOMER_ID, productId: GADGET_ID, quantity: 100 });
    expect(res.status).toBe(400);
  });

  it("does not save the purchase or touch the balance if shipment creation fails", async () => {
    const before = await api().get(`/customers/${OTHER_CUSTOMER_ID}/credit`);
    const purchasesBefore = await api().get(`/customers/${OTHER_CUSTOMER_ID}/purchases`);

    const res = await api().post("/purchases").send({ customerId: OTHER_CUSTOMER_ID, productId: UNSHIPPABLE_ID, quantity: 1 });
    expect(res.status).toBe(502);

    const after = await api().get(`/customers/${OTHER_CUSTOMER_ID}/credit`);
    expect(after.body.balance).toBe(before.body.balance);

    const purchasesAfter = await api().get(`/customers/${OTHER_CUSTOMER_ID}/purchases`);
    expect(purchasesAfter.body).toHaveLength(purchasesBefore.body.length);
  });

  it("applies a promo code discount", async () => {
    const res = await api()
      .post("/purchases")
      .send({ customerId: OTHER_CUSTOMER_ID, productId: GADGET_ID, quantity: 1, promoCode: "FIVEOFF" })
      .expect(201);

    expect(res.body.discountAmount).toBe(5);
    expect(res.body.totalPrice).toBe(94.99);
  });

  it("rejects an unknown promo code", async () => {
    const res = await api()
      .post("/purchases")
      .send({ customerId: OTHER_CUSTOMER_ID, productId: WIDGET_ID, quantity: 1, promoCode: "NOT-A-CODE" });
    expect(res.status).toBe(400);
  });
});

describe("refunds", () => {
  it("supports partial and then full refund of a purchase", async () => {
    await api().post(`/customers/${CUSTOMER_ID}/credit/grant`).send({ amount: 100, reason: "seed" });
    const purchase = await api().post("/purchases").send({ customerId: CUSTOMER_ID, productId: WIDGET_ID, quantity: 2 }).expect(201);
    const purchaseId = purchase.body.id;

    const beforeBalance = (await api().get(`/customers/${CUSTOMER_ID}/credit`)).body.balance;

    const partial = await api().post(`/purchases/${purchaseId}/refund`).send({ quantity: 1, reason: "changed mind" }).expect(200);
    expect(partial.body.status).toBe("PARTIALLY_REFUNDED");
    expect(partial.body.refundedAmount).toBe(25);

    const full = await api().post(`/purchases/${purchaseId}/refund`).send({ quantity: 1 }).expect(200);
    expect(full.body.status).toBe("REFUNDED");
    expect(full.body.refundedAmount).toBe(50);

    const balance = await api().get(`/customers/${CUSTOMER_ID}/credit`);
    expect(balance.body.balance).toBe(beforeBalance + 50);
  });

  it("rejects refunding more than remains on the purchase", async () => {
    const purchase = await api().post("/purchases").send({ customerId: CUSTOMER_ID, productId: WIDGET_ID, quantity: 1 }).expect(201);

    const res = await api().post(`/purchases/${purchase.body.id}/refund`).send({ quantity: 5 });
    expect(res.status).toBe(400);
  });
});
