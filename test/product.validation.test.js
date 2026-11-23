const assert = require("node:assert/strict");
const { test } = require("node:test");

Object.assign(process.env, {
  IMAGE_PUBLIC_KEY: "test-fixture",
  IMAGE_PRIVATE_KEY: "test-fixture",
  IMAGE_URL_ENDPOINT: "https://example.invalid",
});

const Product = require("../src/models/product.model");
const Cart = require("../src/models/cart.model");
const imagekit = require("../src/config/imagekit");
const products = require("../src/controller/product.controller");
const carts = require("../src/controller/cart.controller");

const productId = "000000000000000000000002";
const userId = "000000000000000000000001";
const image = "https://example.invalid/image";
const fields = { name: "Fixture shirt", description: "Fixture", price: 25, category: "Clothing" };

async function request(handler, { id, stock, body, params = { id }, file } = {}) {
  const res = {
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  await handler({ params, body: body ?? { stock }, user: { id: userId }, file }, res);
  return res;
}


function stubProductOperations(t, expected) {
  return [
    t.mock.method(Product, "findById", () => ({
      populate: async () => expected,
    })),
    t.mock.method(Product, "findByIdAndUpdate", async () => expected),
  ];
}

const productHandlers = [products.getProductById, products.updateProduct];

test("product detail and update reject malformed and missing IDs before a query", async (t) => {
  const queries = stubProductOperations(t, null);

  for (const handler of productHandlers) {
    for (const id of ["invalid", "", undefined]) {
      const { code, payload } = await request(handler, { id });
      assert.equal(code, 400);
      assert.deepEqual(payload, {
        success: false,
        message: "Invalid product ID",
      });
    }
  }

  assert.deepEqual(queries.map((query) => query.mock.callCount()), [0, 0]);
});

for (const recordExists of [true, false]) {
  test(`product detail and update return ${recordExists ? "200 for matching records" : "404 for missing records"}`, async (t) => {
    const queries = stubProductOperations(
      t,
      recordExists ? { _id: productId } : null
    );

    for (const handler of productHandlers) {
      const { code } = await request(handler, {
        id: productId,
        body: { name: "Fixture" },
      });
      assert.equal(code, recordExists ? 200 : 404);
    }

    assert.deepEqual(
      queries.map((query) => query.mock.calls[0].arguments[0]),
      [productId, productId]
    );
  });
}

test("product detail preserves 500 for unexpected database errors", async (t) => {
  t.mock.method(console, "error", () => {});
  t.mock.method(Product, "findById", () => { throw new Error("fixture database error"); });
  const { code, payload } = await request(products.getProductById, { id: productId });
  assert.equal(code, 500);
  assert.deepEqual(payload, { success: false, message: "Failed to fetch product" });
});

const file = { buffer: Buffer.from("fixture"), originalname: "fixture.png" };
test("creation and update reject invalid stock before upload or write", async (t) => {
  const upload = t.mock.method(imagekit, "upload", async () => ({ url: image }));
  const create = t.mock.method(Product, "create", async () => ({}));
  const update = t.mock.method(Product, "findByIdAndUpdate", async () => ({}));

  for (const stock of [1.5, "1.5", -1, "-1", null, true, "", "9007199254740990.5"]) {
    const creation = await request(products.createProduct, { body: { ...fields, stock }, file });
    const edition = await request(products.updateProduct, { id: productId, stock });
    for (const { code, payload } of [creation, edition]) {
      assert.equal(code, 400);
      assert.deepEqual(payload, { success: false, message: "Stock must be a nonnegative whole number" });
    }
  }

  const missing = await request(products.createProduct, { body: fields, file });
  assert.equal(missing.code, 400);
  assert.deepEqual([upload, create, update].map((call) => call.mock.callCount()), [0, 0, 0]);
});

test("creation and update preserve zero and positive stock, including multipart strings", async (t) => {
  t.mock.method(imagekit, "upload", async () => ({ url: image }));
  const create = t.mock.method(Product, "create", async (document) => document);
  const update = t.mock.method(Product, "findByIdAndUpdate", async (id, updates) => ({ _id: id, ...updates }));

  for (const units of [0, 12]) {
    const creation = await request(products.createProduct, { body: { ...fields, stock: String(units) }, file });
    assert.equal(creation.code, 201);
    assert.equal(creation.payload.data.stock, units);
    const edition = await request(products.updateProduct, { id: productId, stock: units });
    assert.equal(edition.code, 200);
    assert.equal(edition.payload.data.stock, units);
  }
  assert.equal(create.mock.callCount(), 2);
  assert.equal(update.mock.callCount(), 2);
});

test("product update rejects database operator payloads before a write", async (t) => {
  const update = t.mock.method(Product, "findByIdAndUpdate", async () => ({}));
  const { code } = await request(products.updateProduct, { id: productId, body: { $inc: { stock: 0.5 } } });
  assert.equal(code, 400);
  assert.equal(update.mock.callCount(), 0);
});


test("product update rejects protected and unsupported fields before a write", async (t) => {
  const update = t.mock.method(Product, "findByIdAndUpdate", async () => ({}));

  for (const body of [
    { createdBy: userId },
    { image: "https://example.invalid/forged-image" },
    { unknownField: "unexpected" },
  ]) {
    const { code, payload } = await request(products.updateProduct, {
      id: productId,
      body,
    });

    assert.equal(code, 400);
    assert.match(payload.message, /Unsupported product fields/);
  }

  assert.equal(update.mock.callCount(), 0);
});


test("the Product schema accepts nonnegative whole units only", async () => {
  const product = (stock) => new Product({ ...fields, stock, image, createdBy: userId });
  for (const stock of [1.5, -1]) {
    await assert.rejects(product(stock).validate(), { name: "ValidationError" });
  }
  for (const stock of [0, 12]) await product(stock).validate();
});

test("cart add, quantity update and removal reject missing and malformed product IDs", async (t) => {
  const findProduct = t.mock.method(Product, "findById", async () => null);
  const findCart = t.mock.method(Cart, "findOne", async () => null);
  for (const productId of [undefined, "invalid"]) {
    const params = { productId };
    const body = { productId, quantity: 1 };
    for (const handler of [carts.addToCart, carts.updateCartQuantity, carts.removeFromCart]) {
      assert.equal((await request(handler, { params, body })).code, 400);
    }
  }
  assert.equal(findProduct.mock.callCount(), 0);
  assert.equal(findCart.mock.callCount(), 0);
});


test("delete product marks it unavailable and removes it from carts", async (t) => {
  const product = {
    _id: productId,
    isAvailable: true,
    save: t.mock.fn(async function () {
      return this;
    }),
  };

  t.mock.method(Product, "findById", async () => product);

  const cartUpdate = t.mock.method(Cart, "updateMany", async () => ({
    acknowledged: true,
    modifiedCount: 1,
  }));

  const { code, payload } = await request(products.deleteProduct, {
    id: productId,
  });

  assert.equal(code, 200);
  assert.equal(product.isAvailable, false);
  assert.equal(product.save.mock.callCount(), 1);
  assert.equal(cartUpdate.mock.callCount(), 1);

  const [filter, update] = cartUpdate.mock.calls[0].arguments;
  assert.deepEqual(filter, {});
  assert.deepEqual(update, {
    $pull: { products: { productId: product._id } },
  });

  assert.equal(payload.success, true);
});

test("delete product returns 404 when the product does not exist", async (t) => {
  t.mock.method(Product, "findById", async () => null);
  const cartUpdate = t.mock.method(Cart, "updateMany", async () => ({}));

  const { code, payload } = await request(products.deleteProduct, {
    id: productId,
  });

  assert.equal(code, 404);
  assert.equal(cartUpdate.mock.callCount(), 0);
  assert.equal(payload.success, false);
});

test("delete product returns 500 when database operations fail", async (t) => {
  t.mock.method(console, "error", () => {});
  t.mock.method(Product, "findById", async () => {
    throw new Error("fixture database error");
  });

  const { code, payload } = await request(products.deleteProduct, {
    id: productId,
  });

  assert.equal(code, 500);
  assert.equal(payload.success, false);
});
