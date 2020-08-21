const bcrypt = require("bcryptjs");

// lib that helps us with creating secure unique random values
const crypto = require("crypto");

const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");

// setup that tells nodemailer how emails will be delivered --> use sendGrid
const transporter = nodemailer.createTransport(
  sendgridTransport({
    // authentication to use sendgrid api
    auth: {
      api_key: process.env.SENDGRID_KEY,
    },
  })
);

const expValidator = require("express-validator");

const User = require("../models/user");

exports.getLogin = (req, res, next) => {
  // req.get() gets the value of a header in the parameter
  // const isLoggedIn = req.get("Cookie").split("=")[1];

  // req.flash('error') is an ARRAY with a string inside
  let message = req.flash("error");

  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }

  res.render("auth/login", {
    path: "/login",
    pageTitle: "Login",
    // get the value of the "error" key stored in the user's session
    // this information will be removed from the session once it is acquired
    errorMessage: message,
    oldInput: {
      email: "",
      password: "",
    },
    validationErrors: [],
  });
};

exports.postLogin = (req, res, next) => {
  // authenticating like this WILL NOT WORK
  // because this data is LOST after the response is sent back for the request
  // res.redirect sends back a redirect response to the client which makes a brand new request to the redirect location
  // Thus, the property is not saved for the next request
  // Different request are not related to one another
  // req.isLoggedIn = true;

  // Set a cookie by setting a header
  // 'Set-Cookie' is a reserved name for setting the cookie
  // second param is the value of the header --> key value pair where we define any name we want and any value we want
  // The browse by default sends it to the server with every request once the cookie is set
  // Can also set configurations like "loggedIn=true; Expires=__" because if we dont set this it will expire once we close the browser
  // Can also set configurations like "loggedIn=true; Max-Age=__" number in seconds for how long cookie lasts
  // "Domain=___" domain to which the cookie should be sent
  // "Secure" cookie will only be sent if the page is served via HTTPS
  // "HttpOnly" Now we cant READ the cookie value through client-side javascript --> the cookie's value CANNOT be READ by clients (can still be edited by users)
  // This is important for authintication where coookie will not store sensitive info but will store an important part of authenticating the user
  // res.setHeader("Set-Cookie", "loggedIn=true");

  const errors = expValidator.validationResult(req);

  const email = req.body.email;
  const password = req.body.password;

  if (!errors.isEmpty()) {
    console.log(errors.array());

    // 422 is a status code to indicate that validation has failed
    // we want to render the same page again if validation has failed
    // Make sure to return this render() statement so that code after
    // does not execute
    return res.status(422).render("auth/login", {
      path: "/login",
      pageTitle: "login",
      // errors object has .array() function to return
      // all the errors in an array
      errorMessage: errors.array()[0].msg,
      oldInput: {
        email: email,
        password: password,
      },
      validationErrors: errors.array(),
    });
  }

  // find the user with the entered email
  User.findOne({ email: email })
    .then((user) => {
      // no user found
      if (!user) {
        return res.status(422).render("auth/login", {
          path: "/login",
          pageTitle: "login",
          // errors object has .array() function to return
          // all the errors in an array
          errorMessage: "Invalid email or password",
          oldInput: {
            email: email,
            password: password,
          },
          validationErrors: [],
        });
      }

      // 1st arg: enter the string we want to check
      // 2nd arg: hashed value of that potential string
      bcrypt
        .compare(password, user.password)
        .then((doMatch) => {
          // result is a bool that is true if string and hashed string are equal, false otherwise

          if (doMatch) {
            // session property is added by the session middleware
            // after .session we can add any key we want
            req.session.isLoggedIn = true;

            // store the user in a new session document in the database only after the user has logged in
            // for every NEW request, the session middleware DOES NOT fetch the user with the help of mongoose/sequelize
            // when we call "req.session.user", it just fetches it from mongodb/mysql
            // Thus, the express-session will ONLY fetch the data and NOT a mongoose/sequelize object with all the helper methods
            req.session.user = user;

            // when redirecting, we send back a redirect response (with the cookie for the session)
            // session.save() is automatically called at the end of the HTTP response if the session data has been altered to create the session
            // The redirect is done independently of writing the session to the db so we might redirect too early
            // therefore, use request.session.save() and pass a callback to ensure that the session was created and saved to the db before we do the callback instead of just executing the redirect
            // request.session.save() is not normally needed, only needed if we must ensure session is saved before doing something else
            // res.redirect("/");
            return req.session.save(() => {
              res.redirect("/");
            });
          } else {
            return res.status(422).render("auth/login", {
              path: "/login",
              pageTitle: "login",
              // errors object has .array() function to return
              // all the errors in an array
              errorMessage: "Invalid email or password",
              oldInput: {
                email: email,
                password: password,
              },
              validationErrors: [],
            });
          }
        })
        .catch((err) => {
          // will onyl go to error if something goes wrong, not if strings dont match
          console.log(err);
          res.redirect("/login");
        });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpsStatusCode = 500;
      return next(error);
    });
};

exports.postLogout = (req, res, next) => {
  // clear the current session from the database
  // takes a method which will be called once its done destroying the session
  req.session.destroy((err) => {
    console.log(err);
    res.redirect("/");
  });
};

exports.getSignup = (req, res, next) => {
  let message = req.flash("error");

  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }

  res.render("auth/signup", {
    path: "/signup",
    pageTitle: "Signup",
    errorMessage: message,
    oldInput: {
      email: "",
      password: "",
      confirmPassword: "",
    },
    validationErrors: [],
  });
};

exports.postSignup = (req, res, next) => {
  // extract info from incoming req
  const email = req.body.email;
  const password = req.body.password;

  // validationResult() helps us to gather all the errors prior validation middleware
  // might have thrown
  // expValidator middleware will have added errors that can now be retrieved
  // from the request object
  const errors = expValidator.validationResult(req);

  if (!errors.isEmpty()) {
    // 422 is a status code to indicate that validation has failed
    // we want to render the same page again if validation has failed
    // Make sure to return this render() statement so that code after
    // does not execute
    return res.status(422).render("auth/signup", {
      path: "/signup",
      pageTitle: "Signup",
      // errors object has .array() function to return
      // all the errors in an array
      // msg is a property of each element in the errors array
      // (just console log the errors array to see what each object looks like)
      errorMessage: errors.array()[0].msg,
      // render the page with the old input still filled
      // in for user experience
      oldInput: {
        email: email,
        password: password,
        confirmPassword: req.body.confirmPassword,
      },
      validationErrors: errors.array(),
    });
  }

  // We know the user does not exist already becaues we check for the
  // user's existence ahead of time in our auth.js routes
  // Therefore, we can start using bcrypt to create a hashed password
  // 1st arg: takes a string that we want to hash
  // 2nd arg: salt -> how many rounds of hashing will be applied
  // returns a promise
  bcrypt
    .hash(password, 12)
    .then((hashedPassword) => {
      const user = new User({
        email: email,
        password: hashedPassword,
        cart: { items: [] },
      });

      // return this promise so that we can chain a .then() block
      // ONCE SAVING IS DONE AND NOT BEFORE
      return user.save();
    })
    .then((result) => {
      // do not wait for email to be sent to redirect, redirect right away
      res.redirect("login");
      // send email to confirm that user has successfully signed up
      // 1st arg: object to configure the email we want to send
      // returns promise
      return transporter.sendMail({
        to: email,
        from: "daylansit@gmail.com",
        subject: "Daylan's Shop - Sign Up Successful",
        html: "<h1>You have successfully signed up to Daylan's shop</h1>",
      });
    })
    // .catch() and .then() only apply to the code that lines up with them
    .catch((err) => {
      const error = new Error(err);
      error.httpsStatusCode = 500;
      return next(error);
    });
};

exports.getReset = (req, res, next) => {
  let message = req.flash("error");

  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }

  res.render("auth/reset", {
    path: "/reset",
    pageTitle: "Reset Password",
    errorMessage: message,
  });
};

exports.postReset = (req, res, next) => {
  // generate 32 random bytes, will call the callback once its done
  // buffer is the randomly generated bytes: A buffer contains data that is stored for a short amount of time
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
      return res.redirect("/reset");
    }

    // generate token from the buffer
    // buffer will store hexadecimal values, 'hex' arg converts hexadecimal to ASCII
    // token should be stored on the user who generated this post reset request in the db
    const token = buffer.toString("hex");

    // email is sent in the post request
    User.findOne({ email: req.body.email })
      .then((user) => {
        if (!user) {
          req.flash("error", "No account with that e-mail found");
          return res.redirect("/reset");
        }

        user.resetToken = token;
        // set expiration date to the time now + an hour
        user.resetTokenExpiration = Date.now() + 3600000;
        return user.save();
      })
      .then((result) => {
        res.redirect("/");
        transporter.sendMail({
          to: req.body.email,
          from: "daylan.sit@gmail.com",
          subject: "Password Reset",
          html: `
          <p>You requested a password reset.<p>
          <p>CLick this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password:<p>
          `,
        });
      })
      .catch((err) => {
        const error = new Error(err);
        error.httpsStatusCode = 500;
        return next(error);
      });
  });
};

exports.getNewPassword = (req, res, next) => {
  // get token from the dynamic URL route
  const token = req.params.token;

  // only render the new-password page if we find the user with the token in the URL and token is not expired
  // find the User who has the token and ensure the date is NOT expired
  // $gt is "greater than" --> resetTokenExpiration must be greater than the date now
  User.findOne({
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() },
  })
    .then((user) => {
      let message = req.flash("error");

      if (message.length > 0) {
        message = message[0];
      } else {
        message = null;
      }
      res.render("auth/new-password", {
        path: "/new-password",
        pageTitle: "New Password",
        errorMessage: message,
        // pass userId into the view so that it can
        // be included in the POST request where we will update the password
        // so that it can update the password in the db
        userId: user._id.toString(),

        // pass the pasword token into rendering the page so it can also be used
        // in the post request to update the password
        passwordToken: token,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpsStatusCode = 500;
      return next(error);
    });
};

exports.postNewPassword = (req, res, next) => {
  const newPassword = req.body.password;
  const userId = req.body.userId;

  // password token is passed when the new-password page is first rendered
  const passwordToken = req.body.passwordToken;
  let resetUser;

  User.findOne({
    // do token check again to execute the change of password
    resetToken: passwordToken,
    resetTokenExpiration: { $gt: Date.now() },
    _id: userId,
  })
    .then((user) => {
      resetUser = user;
      // update user object
      return bcrypt.hash(newPassword, 12);
    })
    .then((hashedPassword) => {
      resetUser.password = hashedPassword;
      resetUser.resetToken = undefined;
      resetUser.resetTokenExpiration = undefined;
      return resetUser.save();
    })
    .then((result) => {
      res.redirect("/login");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpsStatusCode = 500;
      return next(error);
    });
};
