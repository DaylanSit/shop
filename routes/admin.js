const path = require("path");

const express = require("express");

const adminController = require("../controllers/admin");
const expValidator = require("express-validator");

const router = express.Router();

// Add isAuth route to the routes we want to protect
// *** We can add as many handlers as we want for any route  ***
// The request will be funneled through the handlers from left to right until a response is sent back
const isAuth = require("../middleware/is-auth");

// /admin/add-product => GET
router.get("/add-product", adminController.getAddProduct);

// /admin/products => GET
router.get("/products", adminController.getProducts);

// /admin/add-product => POST
router.post(
  "/add-product",
  [
    expValidator
      .body("title", "Please enter a title that is at least 3 characters long")
      .isString()
      .isLength({ min: 3 })
      .trim(),
    expValidator
      .body("price", "Please enter a valid price with 2 decimal places")
      .isCurrency({ allow_negatives: false })
      .trim(),
    expValidator
      .body(
        "description",
        "Please enter a description that is at least 5 characters long"
      )
      .isLength({ min: 5, max: 400 })
      .trim(),
  ],
  adminController.postAddProduct
);

router.get("/edit-product/:productId", adminController.getEditProduct);

router.post(
  "/edit-product",
  [
    expValidator
      .body("title", "Please enter a title that is at least 3 characters long")
      .isString()
      .isLength({ min: 3 })
      .trim(),
    expValidator.body("price").isFloat().trim(),
    expValidator
      .body(
        "description",
        "Please enter a description that is at least 5 characters long"
      )
      .isLength({ min: 5, max: 400 })
      .trim(),
  ],
  adminController.postEditProduct
);

router.delete("/product/:productId", adminController.deleteProduct);

module.exports = router;
