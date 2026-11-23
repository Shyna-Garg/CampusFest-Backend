
const assert = require("node:assert/strict");
const { test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const Product = require("../src/models/product.model");
const Order = require("../src/models/order.model");
const { cancelOrder } = require("../src/controller/order.controller");

test("cancellation rolls back order status and earlier stock updates when a later stock update fails", async (t) => {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });

  t.after(async () => {
    await mongoose.disconnect();
    await replSet.stop();
  });

  await mongoose.connect(replSet.getUri());

  const userId = new mongoose.Types.ObjectId();
  const firstProductId = new mongoose.Types.ObjectId();
  const secondProductId = new mongoose.Types.ObjectId();
  const orderId = new mongoose.Types.ObjectId();

  await Product.create([
    {
      _id: firstProductId,
      name: "First test shirt",
      description: "Rollback fixture",
      price: 10,
      category: "Clothing",
      stock: 1,
      image: "https://example.invalid/first.png",
      isAvailable: true,
      createdBy: userId,
    },
    {
      _id: secondProductId,
      name: "Second test shirt",
      description: "Rollback fixture",
      price: 10,
      category: "Clothing",
      stock: 10,
      image: "https://example.invalid/second.png",
      isAvailable: true,
      createdBy: userId,
    },
  ]);

  await Order.create({
    _id: orderId,
    userId,
    products: [
      { productId: firstProductId, quantity: 2, price: 10 },
      { productId: secondProductId, quantity: 2, price: 10 },
    ],
    totalAmount: 40,
    shippingAddress: "Integration test address",
    paymentMethod: "COD",
    paymentStatus: "Pending",
    orderStatus: "Pending",
  });

  // Force the second stock restoration to fail at the MongoDB server.
  await Product.collection.conn.db.command({
    collMod: Product.collection.collectionName,
    validator: {
      $jsonSchema: {
        bsonType: "object",
        properties: {
          stock: {
            bsonType: ["int", "long", "double", "decimal"],
            maximum: 10,
          },
        },
      },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await cancelOrder(
      {
        params: { id: orderId.toString() },
        user: { id: userId.toString() },
      },
      res
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 500);

  const orderAfter = await Order.findById(orderId).lean();
  const firstProductAfter = await Product.findById(firstProductId).lean();
  const secondProductAfter = await Product.findById(secondProductId).lean();

  assert.equal(orderAfter.orderStatus, "Pending");
  assert.equal(firstProductAfter.stock, 1);
  assert.equal(secondProductAfter.stock, 10);
});
