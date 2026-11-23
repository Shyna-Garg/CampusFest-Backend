const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const mongoose = require("mongoose");


async function addToCart(req, res) {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user.id;

    // Validate product ID
    if (!mongoose.isObjectIdOrHexString(productId)) {
      return res.status(400).json({
        success: false,
        message: "A valid Product ID is required",
      });
    }

    // Validate quantity: positive integer only
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive integer",
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (!product.isAvailable || product.stock < 1) {
      return res.status(400).json({
        success: false,
        message: "Product is out of stock",
      });
    }

    let cart = await Cart.findOne({ userId });

    const existingProduct = cart?.products.find(
      (item) => item.productId.toString() === productId
    );

    const existingQuantity = existingProduct
      ? existingProduct.quantity
      : 0;

    // Validate total quantity, including existing cart quantity
    if (existingQuantity + quantity > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock - existingQuantity} more item(s) can be added`,
      });
    }

    if (!cart) {
      cart = await Cart.create({
        userId,
        products: [{ productId, quantity }],
      });

      return res.status(201).json({
        success: true,
        message: "Product added to cart",
        data: cart,
      });
    }

    if (existingProduct) {
      existingProduct.quantity += quantity;
    } else {
      cart.products.push({ productId, quantity });
    }

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      data: cart,
    });
  } catch (err) {
    console.error("Add To Cart Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function getCart(req, res) {
  console.log("GET CART API HIT");
  try {
    const userId = req.user.id;

    const cart = await Cart.findOne({ userId }).populate(
      "products.productId",
      "name price image stock category"
    );

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart is empty",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cart fetched successfully",
      data: cart,
    });

  } catch (err) {
    console.error("Get Cart Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function updateCartQuantity(req, res) {
  try {
    const userId = req.user.id;
    const productId = req.params.productId;
    const { quantity } = req.body;


if (!Number.isSafeInteger(quantity) || quantity < 1) {
  return res.status(400).json({
    success: false,
    message: "Quantity must be a positive integer",
  });
}


    // Validate MongoDB ObjectId
    if (!mongoose.isObjectIdOrHexString(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // Check if product exists
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Stock validation
    if (quantity > product.stock) {
      return res.status(400).json({
        success: false,
        message: "Requested quantity exceeds available stock",
      });
    }

    // Find user's cart
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Find product in cart
    const cartProduct = cart.products.find(
      (item) => item.productId.toString() === productId
    );

    if (!cartProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart",
      });
    }

    // Update quantity
    cartProduct.quantity = quantity;

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      data: cart,
    });

  } catch (err) {
    console.error("Update Cart Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

async function removeFromCart(req, res) {
  try {
    const userId = req.user.id;
    const productId = req.params.productId;

    if (!mongoose.isObjectIdOrHexString(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    // Find user's cart
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    // Check if product exists in cart
    const productExists = cart.products.find(
      (item) => item.productId.toString() === productId
    );

    if (!productExists) {
      return res.status(404).json({
        success: false,
        message: "Product not found in cart",
      });
    }

    // Remove product
    cart.products = cart.products.filter(
      (item) => item.productId.toString() !== productId
    );

    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Product removed from cart successfully",
      data: cart,
    });

  } catch (err) {
    console.error("Remove Cart Item Error:", err);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

module.exports = {addToCart, getCart, updateCartQuantity, removeFromCart}
