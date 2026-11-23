const assert = require("node:assert/strict");
const { test } = require("node:test");
const mongoose = require("mongoose");
const Order = require("../src/models/order.model");
const { placeOrder, updateOrderStatus } = require("../src/controller/order.controller");

const id = "000000000000000000000001";

function response() {
  return {
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("UPI and Card are rejected before a database session regardless of claimed payment status", async (t) => {
  const startSession = t.mock.method(mongoose, "startSession", async () => {
    assert.fail("disabled payment methods must not start a database session");
  });
  const fixtures = [
    { paymentMethod: "UPI" },
    { paymentMethod: "Card", paymentStatus: "Failed" },
    { paymentMethod: "UPI", paymentStatus: "Paid", orderStatus: "Confirmed" },
    { paymentMethod: "Card", paymentStatus: "Paid", paymentId: "unverified-client-value" },
  ];
  for (const fields of fixtures) {
    const res = response();
    await placeOrder({ user: { id }, body: { shippingAddress: "Fixture", ...fields } }, res);
    assert.equal(res.code, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /Prepaid checkout is unavailable/);
  }
  assert.equal(startSession.mock.callCount(), 0);
});

test("admin cannot advance legacy prepaid orders without a verification path", async (t) => {
  const find = t.mock.method(Order, "findById", async () => null);
  const update = t.mock.method(Order, "findOneAndUpdate", async () => null);
  for (const fixture of [
    { paymentMethod: "UPI", paymentStatus: "Pending", orderStatus: "Pending", next: "Confirmed" },
    { paymentMethod: "Card", paymentStatus: "Failed", orderStatus: "Pending", next: "Confirmed" },
    { paymentMethod: "Card", paymentStatus: "Paid", orderStatus: "Pending", next: "Confirmed" },
    { paymentMethod: "UPI", paymentStatus: "Pending", orderStatus: "Confirmed", next: "Shipped" },
    { paymentMethod: "Card", paymentStatus: "Pending", orderStatus: "Shipped", next: "Delivered" },
  ]) {
    find.mock.mockImplementation(async () => fixture);
    const res = response();
    await updateOrderStatus({
      params: { id }, body: { orderStatus: fixture.next, paymentStatus: "Paid" },
    }, res);
    assert.equal(res.code, 409);
    assert.match(res.body.message, /payment verification/);
  }
  assert.equal(update.mock.callCount(), 0);
});

test("COD orders can be confirmed while payment is pending without changing payment status", async (t) => {
  const stored = { paymentMethod: "COD", paymentStatus: "Pending", orderStatus: "Pending" };
  t.mock.method(Order, "findById", async () => stored);
  const update = t.mock.method(Order, "findOneAndUpdate", async (filter, change) => {
    assert.deepEqual(filter, { _id: id, orderStatus: "Pending", paymentMethod: "COD" });
    assert.deepEqual(change, { $set: { orderStatus: "Confirmed" } });
    return { ...stored, ...change.$set };
  });
  const res = response();
  await updateOrderStatus({ params: { id }, body: { orderStatus: "Confirmed", paymentStatus: "Paid" } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.data.orderStatus, "Confirmed");
  assert.equal(res.body.data.paymentStatus, "Pending");
  assert.equal(update.mock.callCount(), 1);
});
