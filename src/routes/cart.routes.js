const express = require("express");

const cartController = require("../controller/cart.controller");
const auth = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/", auth.auth, cartController.addToCart);

router.get("/", auth.auth,cartController.getCart);

router.put("/:productId", auth.auth, cartController.updateCartQuantity);

router.delete("/:productId", auth.auth, cartController.removeFromCart);

module.exports = router;