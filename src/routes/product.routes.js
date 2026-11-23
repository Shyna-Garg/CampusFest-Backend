const express = require("express");
const productController = require("../controller/product.controller");
const auth = require("../middlewares/auth.middleware");
const adminRoleCheck = require("../middlewares/admin.middleware");
const upload = require("../middlewares/upload.middleware")

const router = express.Router();

router.post("/",auth.auth,adminRoleCheck.adminRoleCheck,upload.single("image"),productController.createProduct);

router.get("/",productController.getAllProducts);

router.get("/:id",productController.getProductById);

router.put("/:id", auth.auth, adminRoleCheck.adminRoleCheck,productController.updateProduct);

router.delete("/:id", auth.auth, adminRoleCheck.adminRoleCheck,productController.deleteProduct);

module.exports = router;