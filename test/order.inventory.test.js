const assert = require("node:assert/strict");
const { test } = require("node:test");
const mongoose = require("mongoose");
const Cart = require("../src/models/cart.model");
const Order = require("../src/models/order.model");
const Product = require("../src/models/product.model");
const { placeOrder, cancelOrder } = require("../src/controller/order.controller");

const userId = "000000000000000000000001";
const productId = "000000000000000000000002";
const orderId = "000000000000000000000003";
const checkout = {
  user: { id: userId },
  body: { shippingAddress: "Test address" },
};

function stubSession(t) {
  const session = {
    async withTransaction(callback) { return callback(); },
    async endSession() {},
  };
  t.mock.method(mongoose, "startSession", async () => session);
  return session;
}

function response() {
  return {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function stubCheckout(t, { stock, isAvailable, quantity = 1, productPresent = true }) {
  const session = stubSession(t);
  const storedProduct = { _id: productId, name: "Festival T-shirt", price: 25, stock, isAvailable };
  const cart = {
    // A previously populated cart can show the item as enabled.
    products: [{ productId: { ...storedProduct, isAvailable: true }, quantity }],
    async save(options) { assert.equal(options.session, session); },
  };
  const saveCart = t.mock.method(cart, "save");
  t.mock.method(Cart, "findOne", (filter) => {
    assert.deepEqual(filter, { userId });
    return {
      populate(path) {
        assert.equal(path, "products.productId");
        return { session: async (cartSession) => {
          assert.equal(cartSession, session);
          return cart;
        } };
      },
    };
  });
  const updateStock = t.mock.method(Product, "updateOne", async (filter, update, options) => {
    assert.deepEqual(filter, { _id: productId, isAvailable: true, stock: { $gte: quantity } });
    assert.deepEqual(update, { $inc: { stock: -quantity } });
    assert.equal(options.session, session);
    if (!productPresent || storedProduct.isAvailable !== filter.isAvailable ||
        storedProduct.stock < filter.stock.$gte) {
      return { modifiedCount: 0 };
    }
    storedProduct.stock += update.$inc.stock;
    return { modifiedCount: 1 };
  });
  t.mock.method(Product, "findById", (id) => {
    assert.equal(id, productId);
    return {
      lean() { return this; },
      async session(readSession) {
        assert.equal(readSession, session);
        return productPresent ? storedProduct : null;
      },
    };
  });
  const createOrder = t.mock.method(Order, "create", async (orders, options) => {
    assert.equal(options.session, session);
    return orders;
  });
  return { cart, createOrder, saveCart, storedProduct, updateStock };
}

test("checkout reserves the last available units and preserves the availability setting", async (t) => {
  const { cart, createOrder, saveCart, storedProduct, updateStock } = stubCheckout(t, {
    stock: 2, isAvailable: true, quantity: 2,
  });
  const res = response();

  await placeOrder(checkout, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.data.totalAmount, 50);
  assert.deepEqual(res.body.data.products, [{ productId, quantity: 2, price: 25 }]);
  assert.equal(storedProduct.stock, 0);
  assert.equal(storedProduct.isAvailable, true);
  assert.equal(updateStock.mock.callCount(), 1);
  assert.equal(createOrder.mock.callCount(), 1);
  assert.equal(saveCart.mock.callCount(), 1);
  assert.deepEqual(cart.products, []);
});

const rejectedCheckouts = [
  { name: "an administrator-disabled item with sufficient stock", stock: 5, isAvailable: false,
    expectedStatus: 409, expectedMessage: /no longer available/ },
  { name: "an item without a stored availability flag", stock: 5,
    expectedStatus: 409, expectedMessage: /no longer available/ },
  { name: "an enabled item with insufficient stock", stock: 1, isAvailable: true, quantity: 2,
    expectedStatus: 409, expectedMessage: /only 1 item/ },
  { name: "an enabled item with zero stock", stock: 0, isAvailable: true,
    expectedStatus: 409, expectedMessage: /only 0 item/ },
  { name: "an item deleted after the cart read", stock: 1, isAvailable: true, productPresent: false,
    expectedStatus: 404, expectedMessage: /no longer available/ },
];

for (const scenario of rejectedCheckouts) {
  test(`checkout rejects ${scenario.name} without creating an order or clearing the cart`, async (t) => {
    const { cart, createOrder, saveCart, storedProduct } = stubCheckout(t, scenario);
    const res = response();

    await placeOrder(checkout, res);

    assert.equal(res.statusCode, scenario.expectedStatus);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, scenario.expectedMessage);
    assert.equal(storedProduct.stock, scenario.stock);
    assert.equal(storedProduct.isAvailable, scenario.isAvailable);
    assert.equal(cart.products.length, 1);
    assert.equal(createOrder.mock.callCount(), 0);
    assert.equal(saveCart.mock.callCount(), 0);
  });
}

for (const isAvailable of [false, true]) {
  const availability = isAvailable ? "enabled" : "administrator-disabled";
  test(`cancellation restores stock and leaves the item ${availability}`, async (t) => {
    const session = stubSession(t);
    const storedProduct = { stock: 0, isAvailable };
    t.mock.method(Order, "findOneAndUpdate", async (filter, update, options) => {
      assert.deepEqual(filter, { _id: orderId, userId, orderStatus: "Pending" });
      assert.deepEqual(update, { $set: { orderStatus: "Cancelled" } });
      assert.equal(options.session, session);
      return { orderStatus: "Cancelled", products: [{ productId, quantity: 2 }] };
    });
    const restoreStock = t.mock.method(Product, "findByIdAndUpdate", async (id, update, options) => {
      assert.equal(id, productId);
      assert.deepEqual(update, { $inc: { stock: 2 } });
      assert.equal(options.session, session);
      storedProduct.stock += update.$inc.stock;
      return storedProduct;
    });
    const res = response();

    await cancelOrder({ user: { id: userId }, params: { id: orderId } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.orderStatus, "Cancelled");
    assert.equal(restoreStock.mock.callCount(), 1);
    assert.deepEqual(storedProduct, { stock: 2, isAvailable });
  });
}


test("repeated cancellation does not restore stock again", async (t) => {
  const session = stubSession(t);

  t.mock.method(Order, "findOneAndUpdate", async (filter, update, options) => {
    assert.deepEqual(filter, {
      _id: orderId,
      userId,
      orderStatus: "Pending",
    });
    assert.equal(options.session, session);
    return null;
  });

  t.mock.method(Order, "findOne", () => ({
    session: async (currentSession) => {
      assert.equal(currentSession, session);
      return { _id: orderId, orderStatus: "Cancelled" };
    },
  }));

  const restoreStock = t.mock.method(
    Product,
    "findByIdAndUpdate",
    async () => {
      throw new Error("Stock must not be restored");
    }
  );

  const res = response();

  await cancelOrder(
    { user: { id: userId }, params: { id: orderId } },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "Only pending orders can be cancelled");
  assert.equal(restoreStock.mock.callCount(), 0);
});


test("checkout rejects fractional, zero, and negative cart quantities before reserving stock", async (t) => {
  const fixture = stubCheckout(t, { stock: 5, isAvailable: true });
  for (const quantity of [1.5, 0, -1]) {
    fixture.cart.products[0].quantity = quantity;
    const res = response();
    await placeOrder(checkout, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, "Invalid cart quantity");
  }
  assert.equal(fixture.updateStock.mock.callCount(), 0);
  assert.equal(fixture.createOrder.mock.callCount(), 0);
  assert.equal(fixture.saveCart.mock.callCount(), 0);
});

test("checkout rejects legacy fractional stock without writing inventory or clearing the cart", async (t) => {
  const fixture = stubCheckout(t, { stock: 2.5, isAvailable: true });
  const res = response();
  await placeOrder(checkout, res);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /invalid stock/);
  assert.equal(fixture.updateStock.mock.callCount(), 0);
  assert.equal(fixture.createOrder.mock.callCount(), 0);
  assert.equal(fixture.saveCart.mock.callCount(), 0);
});

test("COD checkout ignores a forged paid or confirmed status", async (t) => {
  const fixture = stubCheckout(t, { stock: 5, isAvailable: true });
  const res = response();

  await placeOrder({
    ...checkout,
    body: { ...checkout.body, paymentStatus: "Paid", orderStatus: "Confirmed" },
  }, res);

  assert.equal(res.statusCode, 201);
  const [documents] = fixture.createOrder.mock.calls[0].arguments;
  assert.equal(Object.hasOwn(documents[0], "paymentStatus"), false);
  assert.equal(Object.hasOwn(documents[0], "orderStatus"), false);
  const order = new Order(documents[0]);
  assert.equal(order.paymentMethod, "COD");
  assert.equal(order.paymentStatus, "Pending");
  assert.equal(order.orderStatus, "Pending");
});


test("cancellation returns an error when stock restoration fails", async (t) => {
  const session = stubSession(t);

  t.mock.method(Order, "findOneAndUpdate", async (filter, update, options) => {
    assert.deepEqual(filter, {
      _id: orderId,
      userId,
      orderStatus: "Pending",
    });
    assert.equal(options.session, session);

    return {
      orderStatus: "Cancelled",
      products: [{ productId, quantity: 2 }],
    };
  });

  t.mock.method(Product, "findByIdAndUpdate", async () => {
    throw new Error("Stock restoration failed");
  });

  const res = response();

  await cancelOrder(
    { user: { id: userId }, params: { id: orderId } },
    res
  );

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
});
