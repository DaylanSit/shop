// const express = require("express");

// const authController = require("../controllers/auth");

// const router = express.Router();

// const expValidator = require("express-validator");

// const User = require("../models/user");

// // we want to validate on non GET routes becase we
// // want to validate whenver the user sends data

// router.get("/login", authController.getLogin);

// router.post(
//   "/login",
//   [
//     expValidator
//       .body("email")
//       .isEmail()
//       .withMessage("Please enter a valid email")
//       // make sure email is stored in a normalized way (lowercase, no excess whitespace etc)
//       .normalizeEmail(),
//     expValidator
//       .body(
//         "password",
//         "Please enter a password that is at least five characters long with only alphanumeric characters"
//       )
//       .isLength({ min: 5 })
//       .isAlphanumeric()
//       // trim password to remove excess whitespace
//       .trim(),
//   ],
//   authController.postLogin
// );

// router.post("/logout", authController.postLogout);

// router.get("/signup", authController.getSignup);

// // add an extra middleware to the post route
// // check() is a middleware that will return a an object back that we can chain
// // with more validator functions that can return middleware functions back
// // param is a field name that needs to be checked ("name" field in HTML)
// // after check(),we call isEmail() on the object that is returned from .check()
// // which returns a valid middleware function (that call .next())
// // more validator function can be found on docs of validator.js
// router.post(
//   "/signup",
//   // optional to wrap validators in an array for clarity
//   [
//     expValidator
//       // check looks for the "email" field in the request body, coookies, headers
//       // params, query. If any of the fields are present in more than one location,
//       // then all instances of that field must pass the validation
//       .check("email")
//       .isEmail()
//       // .withMessage will always refer to the validation method right in front of it
//       .withMessage("Please enter a valid email")
//       // can also add a custom validator function
//       // value: value of the field we are checking from check()
//       // object: can extract additional things like the request object
//       .custom((value, { req }) => {
//         // // throw an error when validation fails
//         // if (value == "test@test.com") {
//         //   throw new Error("This email address is forbidden");
//         // }
//         // // if we succeed, return True
//         // return true;

//         // ASYNCHRONOUS VALIDATION --> it is asynchronous bc we have to reach out
//         // to the database which is not an "instant" task

//         // express-validator .custom() will check for a return of true or false to return a promise
//         // or a thrown error
//         // If we return a promise within .custom() (every .then() block returns a new promise)
//         // express-validotr will wait for this promise to be fulfilled. If the promise is resolved,
//         // it treats this validation as successful. Otherwise if there is a rejection then express-validator
//         // will detect this rejection and it will be treated as an error
//         // Find one user by passing a filter
//         // see if we find a user with the email that was acquired in the request
//         return User.findOne({ email: value }).then((userDoc) => {
//           // if we do find a user, dont allow the user to sign up
//           console.log(userDoc);
//           if (userDoc) {
//             //.reject() throws an error inside of the promise
//             return Promise.reject(
//               "User already exists with this e-mail, please use different one"
//             );
//           }
//           return Promise.resolve();
//         });
//       })
//       // make sure email is stored in a uniform way
//       .normalizeEmail(),

//     expValidator
//       // .body() will only check req.body for the field in the params
//       // second param of .body() is error message to be used for all validation functions
//       .body(
//         "password",
//         "Please enter a password that is at least five characters long with only alphanumeric characters"
//       )
//       .isLength({ min: 5 })
//       .isAlphanumeric()
//       .trim(),
//     // check if confirmPasswrod field matches password field
//     expValidator
//       .body("confirmPassword")
//       .trim()
//       .custom((value, { req }) => {
//         if (value !== req.body.password) {
//           // this error is handled behind the scenes by the
//           // express-validator package
//           throw new Error("Passwords do not match");
//         }
//         return true;
//       }),
//   ],
//   authController.postSignup
// );

// router.get("/reset", authController.getReset);

// router.post("/reset", authController.postReset);

// // this request is sent from the reset password email
// // dynamic parameter added to the route
// router.get("/reset/:token", authController.getNewPassword);

// router.post("/new-password", authController.postNewPassword);

// module.exports = router;

const express = require("express");
const { check, body } = require("express-validator/check");

const authController = require("../controllers/auth");
const User = require("../models/user");

const router = express.Router();

router.get("/login", authController.getLogin);

router.get("/signup", authController.getSignup);

router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .withMessage("Please enter a valid email address.")
      .normalizeEmail(),
    body("password", "Password has to be valid.")
      .isLength({ min: 5 })
      .isAlphanumeric()
      .trim(),
  ],
  authController.postLogin
);

router.post(
  "/signup",
  [
    check("email")
      .isEmail()
      .withMessage("Please enter a valid email.")
      .normalizeEmail()
      .custom((value, { req }) => {
        // if (value === 'test@test.com') {
        //   throw new Error('This email address if forbidden.');
        // }
        // return true;

        console.log("in custom");

        return User.findOne({ email: value }).then((userDoc) => {
          console.log(userDoc);
          if (userDoc) {
            return Promise.reject(
              "E-Mail exists already, please pick a different one."
            );
          }
        });
      }),
    body(
      "password",
      "Please enter a password with only numbers and text and at least 5 characters."
    )
      .isLength({ min: 5 })
      .isAlphanumeric()
      .trim(),
    body("confirmPassword")
      .trim()
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Passwords have to match!");
        }
        return true;
      }),
  ],
  authController.postSignup
);

router.post("/logout", authController.postLogout);

router.get("/reset", authController.getReset);

router.post("/reset", authController.postReset);

router.get("/reset/:token", authController.getNewPassword);

router.post("/new-password", authController.postNewPassword);

module.exports = router;
