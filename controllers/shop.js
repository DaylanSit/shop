const Product = require("../models/product");
const Order = require("../models/order");
const fs = require("fs");
const path = require("path");
const PDFdocument = require("pdfkit");
const stripe = require("stripe")(process.env.STRIPE_KEY);

const ITEMS_PER_PAGE_HOME = 3;

exports.getProducts = (req, res, next) => {
  // query parameter "page" is from the index.ejs file
  // "+" converts the value to an integer
  // if the query parameter "page" is null, then we must be on page 1
  const page = +req.query.page || 1;

  let totalItems;

  // product.find() uses a cursor and thus only retrieve the items that we need
  Product.find()
    // counts the total number of records in the Product collection
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;

      return (
        Product.find()
          // skip() skips the first x amound of results
          // depending on which page we are on, we skip the corresponding
          // number of products

          .skip((page - 1) * ITEMS_PER_PAGE_PRODUCTS)
          // limit the number of items we retrieve once we have skipped the previous pages if applicable
          // for the current page we only fetch as many items as we want to display
          .limit(ITEMS_PER_PAGE_PRODUCTS)
      );
    })
    .then((products) => {
      res.render("shop/product-list", {
        prods: products,
        pageTitle: "Products",
        path: "/products",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE_PRODUCTS * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE_PRODUCTS),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpsStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpsStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  // query parameter "page" is from the index.ejs file
  const page = +req.query.page || 1;

  let totalItems;

  Product.find()
    // counts the total number of records in the Product collection
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;

      return (
        Product.find()
          // skip() skips the first x amound of results
          // depending on which page we are on, we skip the corresponding
          // number of products

          .skip((page - 1) * ITEMS_PER_PAGE_HOME)
          // limit the number of items we retrieve once we have skipped the previous pages if applicable
          // for the current page we only fetch as many items as we want to display
          .limit(ITEMS_PER_PAGE_HOME)
      );
    })
    .then((products) => {
      res.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE_HOME * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE_HOME),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpsStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items;
      res.render("shop/cart", {
        path: "/cart",
        pageTitle: "Your Cart",
        products: products,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpsStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then((product) => {
      return req.user.addToCart(product);
    })
    .then((result) => {
      console.log(result);
      res.redirect("/cart");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpsStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then((result) => {
      res.redirect("/cart");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpsStatusCode = 500;
      return next(error);
    });
};

exports.getCheckout = (req, res, next) => {
  let products;
  let total = 0;
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      products = user.cart.items;
      total = 0;

      products.forEach((item) => {
        total += item.quantity * item.productId.price;
      });

      // creates a new Stripe specific session which is needed to execute a payment
      return stripe.checkout.sessions.create({
        // this is the data that Stripe needs
        payment_method_types: ["card"],

        // Stripe needs an array of objects which have the name, description, amount, currency, and quantity fields
        line_items: products.map((p) => {
          // for each product, reformat it to an object which looks like the following:
          return {
            name: p.productId.title,
            description: p.productId.description,
            amount: p.productId.price * 100,
            currency: "usd",
            quantity: p.quantity,
          };
        }),
        // thes are URLs stripe will redirect the user to once the transaction succeeds or fails
        // req.protocol will be http, req.get('host') gets the host address of the server
        success_url:
          req.protocol + "://" + req.get("host") + "/checkout/success",
        cancel_url: req.protocol + "://" + req.get("host") + "/checkout/cancel",
      });
    })
    .then((session) => {
      res.render("shop/checkout", {
        path: "/checkout",
        pageTitle: "Checkout",
        products: products,
        totalSum: total,
        sessionId: session.id,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpsStatusCode = 500;
      return next(error);
    });
};

exports.getCheckoutSuccess = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items.map((i) => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user._id,
        },
        products: products,
      });
      return order.save();
    })
    .then((result) => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect("/orders");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpsStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ "user.userId": req.user._id })
    .then((orders) => {
      res.render("shop/orders", {
        path: "/orders",
        pageTitle: "Your Orders",
        orders: orders,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpsStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  // params is the dynamic route
  const orderId = req.params.orderId;

  // check if the order user ID is equal to the ID of the currently logged in user
  // If we are not the correctly logged in user, we will not allow them to get the file
  Order.findById(orderId)
    .then((order) => {
      if (!order) {
        return next(new Error("No order found"));
      }

      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error("Unauthorized"));
      }

      const invoiceName = "invoice-" + orderId + ".pdf";
      const invoicePath = path.join("data", "invoices", invoiceName);
      const pdfDoc = new PDFdocument();

      // set the content type of the file to pdf so that
      // the browser opens it as a pdf automatically
      res.setHeader("Content-Type", "application/pdf");

      // defines how the content should be served to the client
      // We are defining what the filename should be when downloaded
      // by the client
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="' + invoiceName + '"'
      );

      // in createWriteStream we pass in a path we want to WRITE to
      // This ensures that the pdf we generate is stored on the server
      pdfDoc.pipe(fs.createWriteStream(invoicePath));

      // return pdfDoc to client
      pdfDoc.pipe(res);

      pdfDoc.fontSize(26).text("Invoice", { underline: true });

      pdfDoc.text("--------------------------------------");

      let totalPrice = 0;
      // order.products is an array of objects in the database
      order.products.forEach((prod) => {
        totalPrice += prod.quantity * prod.product.price;
        pdfDoc
          .fontSize(14)
          .text(
            prod.product.title +
              " - " +
              prod.quantity +
              " X " +
              "$" +
              prod.product.price
          );
      });
      pdfDoc.text("--------------------------------------");
      pdfDoc.fontSize(20).text("Total: $" + totalPrice);

      pdfDoc.end();
    })
    .catch((err) => next(err));

  // read the file from our file system
  // reading the entire file data into memory (which is limited) to serve
  // as a response is not good practice because our quick access memory can run out
  // instead we must STREAM our response data
  // fs.readFile(invoicePath, (err, data) => {
  //   if (err) {
  //     return next(err);
  //   }

  //   // set the content type of the file to pdf
  //   res.setHeader("Content-Type", "application/pdf");

  //   // defines how the content should be served to the client
  //   res.setHeader(
  //     "Content-Disposition",
  //     'attachment; filename="' + invoiceName + '"'
  //   );

  //   // send the file back to the user
  //   res.send(data);
  // });

  // // stream response data back to user
  // const file = fs.createReadStream(invoicePath);
  // // set the content type of the file to pdf
  // res.setHeader("Content-Type", "application/pdf");

  // // defines how the content should be served to the client
  // res.setHeader(
  //   "Content-Disposition",
  //   'attachment; filename="' + invoiceName + '"'
  // );

  // // forwards the data that is read in with the stream to the response
  // // the response object is a writable stream and we can use readable
  // // streams to pipe their output to a writable stream
  // // Now Node.js never has to preload all the data into memory before serving it to the user
  // // Instead they are served in little chunks to the browser
  // file.pipe(res);
};
