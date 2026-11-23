const mongoose = require("mongoose");

const Order = require("../models/order.model");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");

const PAYMENT_METHODS = ["COD", "UPI", "Card"];

const ORDER_STATUS_TRANSITIONS = {
  Pending: ["Confirmed"],
  Confirmed: ["Shipped"],
  Shipped: ["Delivered"],
  Delivered: [],
  Cancelled: [],
};

function sendError(res, err, fallbackMessage) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid request data",
    });
  }

  console.error(fallbackMessage, err);

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
}

function createError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

// Place Order
async function placeOrder(req, res) {
  let session;

  try {
    const userId = req.user.id;
    const { shippingAddress, paymentMethod = "COD" } = req.body;

    if (
      typeof shippingAddress !== "string" ||
      !shippingAddress.trim()
    ) {
      throw createError("A valid shipping address is required", 400);
    }

    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw createError("Invalid payment method", 400);
    }

    if (paymentMethod !== "COD") {
      throw createError("Prepaid checkout is unavailable. Use Cash on Delivery", 400);
    }

    session = await mongoose.startSession();
    let createdOrder;

    await session.withTransaction(async () => {
      const cart = await Cart.findOne({ userId })
        .populate("products.productId")
        .session(session);

      if (!cart || cart.products.length === 0) {
        throw createError("Your cart is empty", 400);
      }

      let totalAmount = 0;
      const orderProducts = [];

      for (const item of cart.products) {
        const product = item.productId;
        const quantity = item.quantity;

        if (!product) {
          throw createError(
            "A product in your cart no longer exists",
            404
          );
        }

        if (
          !Number.isSafeInteger(quantity) ||
          quantity < 1
        ) {
          throw createError("Invalid cart quantity", 400);
        }

        if (!Number.isSafeInteger(product.stock) || product.stock < 0) {
          throw createError(`${product.name} has invalid stock`, 409);
        }

        // Reserve stock only while the product is enabled and has enough units.
        const stockUpdate = await Product.updateOne(
          {
            _id: product._id,
            isAvailable: true,
            stock: { $gte: quantity },
          },
          {
            $inc: { stock: -quantity },
          },
          { session }
        );

        if (stockUpdate.modifiedCount !== 1) {
          const latestProduct = await Product.findById(product._id)
            .lean()
            .session(session);

          if (!latestProduct) {
            throw createError(
              `${product.name} is no longer available`,
              404
            );
          }

          if (latestProduct.isAvailable !== true) {
            throw createError(
              `${latestProduct.name} is no longer available`,
              409
            );
          }

          throw createError(
            `${latestProduct.name} has only ${latestProduct.stock} item(s) left in stock`,
            409
          );
        }

        // Always calculate prices from the database, not the client.
        totalAmount += product.price * quantity;

        orderProducts.push({
          productId: product._id,
          quantity,
          price: product.price,
        });
      }

      const orders = await Order.create(
        [
          {
            userId,
            products: orderProducts,
            totalAmount,
            shippingAddress: shippingAddress.trim(),
            paymentMethod,
          },
        ],
        { session }
      );

      createdOrder = orders[0];

      // Clear cart only within the same transaction.
      cart.products = [];
      await cart.save({ session });
    });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: createdOrder,
    });
  } catch (err) {
    return sendError(res, err, "Unable to place order");
  } finally {
    await session?.endSession();
  }
}

// Get Logged-in User's Orders
async function getMyOrders(req, res) {
  try {
    const userId = req.user.id;

    const orders = await Order.find({ userId })
      .populate("products.productId", "name image category")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      count: orders.length,
      data: orders,
    });
  } catch (err) {
    return sendError(res, err, "Unable to fetch orders");
  }
}

// Get One Order Belonging to the Logged-in User
async function getOrderById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      throw createError("Invalid order ID", 400);
    }

    const order = await Order.findOne({
      _id: id,
      userId: req.user.id,
    }).populate("products.productId");

    if (!order) {
      throw createError("Order not found", 404);
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      data: order,
    });
  } catch (err) {
    return sendError(res, err, "Unable to fetch order");
  }
}

// Admin: Update Order Status
async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { orderStatus } = req.body;

    if (!isValidId(id)) {
      throw createError("Invalid order ID", 400);
    }

    if (
      !Object.prototype.hasOwnProperty.call(
        ORDER_STATUS_TRANSITIONS,
        orderStatus
      )
    ) {
      throw createError("Invalid order status", 400);
    }

    if (orderStatus === "Cancelled") {
      throw createError(
        "Use the cancellation workflow to cancel an order",
        400
      );
    }

    const order = await Order.findById(id);

    if (!order) {
      throw createError("Order not found", 404);
    }

    const allowedNextStatuses =
      ORDER_STATUS_TRANSITIONS[order.orderStatus] || [];

    if (!allowedNextStatuses.includes(orderStatus)) {
      throw createError(
        `Cannot change order status from ${order.orderStatus} to ${orderStatus}`,
        400
      );
    }

    if (order.paymentMethod !== "COD") {
      throw createError("Prepaid orders cannot advance until payment verification is available", 409);
    }

    // Conditional update prevents two requests from advancing the
    // same order from a stale status.
    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: id,
        orderStatus: order.orderStatus,
        paymentMethod: "COD",
      },
      {
        $set: { orderStatus },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedOrder) {
      throw createError(
        "Order status changed. Refresh and try again",
        409
      );
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: updatedOrder,
    });
  } catch (err) {
    return sendError(res, err, "Unable to update order status");
  }
}

// User: Cancel a Pending Order and Restore Stock
async function cancelOrder(req, res) {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!isValidId(id)) {
      throw createError("Invalid order ID", 400);
    }

    let cancelledOrder;

    await session.withTransaction(async () => {
      // Change status only if the order is still Pending.
      const order = await Order.findOneAndUpdate(
        {
          _id: id,
          userId,
          orderStatus: "Pending",
        },
        {
          $set: { orderStatus: "Cancelled" },
        },
        {
          new: true,
          session,
          runValidators: true,
        }
      );

      if (!order) {
        const existingOrder = await Order.findOne({
          _id: id,
          userId,
        }).session(session);

        if (!existingOrder) {
          throw createError("Order not found", 404);
        }

        throw createError(
          "Only pending orders can be cancelled",
          400
        );
      }

      // Restore stock without changing the administrator's availability setting.
      for (const item of order.products) {
        const restoredProduct = await Product.findByIdAndUpdate(
          item.productId,
          {
            $inc: { stock: item.quantity },
          },
          {
            new: true,
            session,
          }
        );

        // A deleted product cannot have its stock restored.
        // The order cancellation can still proceed.
        if (restoredProduct && restoredProduct.stock < 0) {
          throw createError("Invalid product stock", 500);
        }
      }

      cancelledOrder = order;
    });

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: cancelledOrder,
    });
  } catch (err) {
    return sendError(res, err, "Unable to cancel order");
  } finally {
    await session.endSession();
  }
}

// Admin: Get All Orders
async function getAllOrders(req, res) {
  try {
    const orders = await Order.find()
      .populate("userId", "username email")
      .populate("products.productId", "name image category")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "All orders fetched successfully",
      count: orders.length,
      data: orders,
    });
  } catch (err) {
    return sendError(res, err, "Unable to fetch all orders");
  }
}

module.exports = {
  placeOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getAllOrders,
};