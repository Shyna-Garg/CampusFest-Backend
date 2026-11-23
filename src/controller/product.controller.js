const { isObjectIdOrHexString } = require("mongoose");
const Product = require("../models/product.model");
const imagekit = require("../config/imagekit");
const Cart = require("../models/cart.model");

function parseStock(value) {
  if (typeof value === "string" && /^\+?\d+(?:\.0+)?$/.test(value.trim())) {
    return Number(value);
  }
  return typeof value === "number" ? value : NaN;
}

function invalidStock(res) {
  return res.status(400).json({
    success: false,
    message: "Stock must be a nonnegative whole number",
  });
}

function invalidProductId(res) {
  return res.status(400).json({
    success: false,
    message: "Invalid product ID",
  });
}

async function createProduct(req, res) {
  try {
    const {
      name,
      description,
      price,
      category,
      stock,
    } = req.body;

    if (
      !name ||
      !description ||
      price === undefined ||
      !category ||
      stock === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    const units = parseStock(stock);
    if (!Number.isSafeInteger(units) || units < 0) {
      return invalidStock(res);
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Product image is required",
      });
    }

    // Upload image to ImageKit
    const uploadedImage = await imagekit.upload({
      file: req.file.buffer.toString("base64"),
      fileName: `${Date.now()}-${req.file.originalname}`,
      folder: "/CampusFest/products",
    });

    const product = await Product.create({
      name,
      description,
      price,
      category,
      stock: units,
      image: uploadedImage.url,
      createdBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });

  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Invalid product data",
      });
    }

    console.error("Create Product Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function getAllProducts(req, res) {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      count: products.length,
      data: products,
    });

  } catch (err) {
    console.error("Get Products Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
}

async function getProductById(req, res) {
  try {
    const productId = req.params.id;
    if (!isObjectIdOrHexString(productId)) {
      return invalidProductId(res);
    }

    const product = await Product.findById(productId).populate(
      "createdBy",
      "username email"
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: product,
    });

  } catch (err) {
    console.error("Get Product Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
}

async function updateProduct(req, res) {
  try {
    const productId = req.params.id;
    if (!isObjectIdOrHexString(productId)) {
      return invalidProductId(res);
    }
    const updates = req.body;
    if (!updates || typeof updates !== "object" || Array.isArray(updates) ||
        Object.keys(updates).some((key) => key.startsWith("$") || key.includes("."))) {
      return res.status(400).json({
        success: false,
        message: "Product updates must contain plain fields",
      });
    }

    const allowedFields = [
  "name",
  "description",
  "price",
  "category",
  "stock",
  "isAvailable",
];

const invalidFields = Object.keys(updates).filter(
  (key) => !allowedFields.includes(key)
);

if (invalidFields.length > 0) {
  return res.status(400).json({
    success: false,
    message: `Unsupported product fields: ${invalidFields.join(", ")}`,
  });
}

const updateData = { ...updates };
    if (Object.hasOwn(updateData, "stock")) {
      const units = parseStock(updateData.stock);
      if (!Number.isSafeInteger(units) || units < 0) {
        return invalidStock(res);
      }
      updateData.stock = units;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: updatedProduct,
    });

  } catch (err) {
    if (err.name === "ValidationError" || err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid product data",
      });
    }

    console.error("Update Product Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to update product",
    });
  }
}


async function deleteProduct(req, res) {
  try {
    const productId = req.params.id;

    if (!isObjectIdOrHexString(productId)) {
      return invalidProductId(res);
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Preserve product references in historical orders.
    product.isAvailable = false;
    await product.save();

    // Remove the unavailable product from users' carts.
    await Cart.updateMany(
      {},
      { $pull: { products: { productId: product._id } } }
    );

    return res.status(200).json({
      success: true,
      message: "Product marked as unavailable successfully",
    });
  } catch (err) {
    console.error("Delete Product Error:", err);

    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
}


module.exports = {
  createProduct, getAllProducts, getProductById, updateProduct, deleteProduct
};