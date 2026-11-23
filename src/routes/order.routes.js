const express = require("express");

const orderController = require("../controller/order.controller");
const auth = require("../middlewares/auth.middleware");
const adminRoleCheck = require("../middlewares/admin.middleware");

const router = express.Router();

router.post("/", auth.auth, orderController.placeOrder);

router.get("/my", auth.auth, orderController.getMyOrders);

router.get("/admin/all", auth.auth, adminRoleCheck.adminRoleCheck, orderController.getAllOrders);

router.get("/:id", auth.auth, orderController.getOrderById)

router.put("/:id/status", auth.auth, adminRoleCheck.adminRoleCheck, orderController.updateOrderStatus)

router.put("/:id/cancel", auth.auth, orderController.cancelOrder)


module.exports = router;