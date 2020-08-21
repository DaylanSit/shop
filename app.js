const path = require("path");

const express = require("express");

const bodyParser = require("body-parser");
const multer = require("multer");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const csrf = require("csurf");
const flash = require("connect-flash");
const { uuid } = require("uuidv4");
const helmet = require("helmet");
const compression = require("compression");

const errorController = require("./controllers/error");

const User = require("./models/user");

// we can access environment variables on the "process" object
// This is an object globally available in Node
// the "env" property is an object with all the environment variables
// this Node process knows
// There are a bunch of default environment variables but we can also set our own
const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0-natnn.mongodb.net/${process.env.MONGO_DEFAULT_DATABASE}`;

const app = express();

const isAuth = require("./middleware/is-auth");

// used for session management
const store = new MongoDBStore({
  // connections string to database so it knows where to store the sessions
  uri: MONGODB_URI,
  // define collection of where sessions will be stored
  collection: "sessions",
});

// this is a middleware that uses the session to store the secret for the hashing
const csrfProtection = csrf();

app.set("view engine", "ejs");
app.set("views", "views");

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

// diskStorage is a storage engine by multer
const fileStorage = multer.diskStorage({
  // two functions which multer calls for an incoming file
  // controls where file is stored and what it is named
  destination: (req, file, cb) => {
    // callback is called once we are done setting up the destination folder
    // name of the folder will be 'images' where the files will be stored
    cb(null, "images");
  },

  // callback is called to let multer know how to name the file
  // file.filename and .original name come with the file object
  filename: (req, file, cb) => {
    cb(null, uuid());
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    // callback with true is called if we want to store the file
    cb(null, true);
  } else {
    // callback with true is called if we dont want to store the file
    cb(null, false);
  }
};

// sets headers on our responses for security reasons
// app.use(helmet());
// compresses publicly served files of CSS and JS --> frontend assets
app.use(compression());

// looks at every request and checks if the content-type field is set
// as "x-www-form-urlencoded". If so, parses that data and stores it in
// the req.body
app.use(bodyParser.urlencoded({ extended: false }));
// looks at every request and checks if the content-type field is set
// as "multipart/form-data". If so, parses that data and tries to extract the
// file from it if its available --> will store it in req.file
// {storage: fileStorage} will store the file on the file system
// ".single()" tells multer we only expect to receive one file
// param of single() is the name of the field in HTML that has the file
//
app.use(
  multer({ storage: fileStorage, fileFilter: fileFilter }).single("image")
);
// statically serving a folder means that requests to files in that folder will
// be handled automatically and the file will be returrned
app.use(express.static(path.join(__dirname, "public")));
// express assumes that the files in the images folder are served as if
// they were in the root folder (slash nothing). Therefore, add '/images' as a
// filter so that if we have a request that starts with /images, then serve the files statically
app.use("/images", express.static(path.join(__dirname, "images")));

// register the session management capabilities of express-session
// looks for a session cookie in the incoming request and finds the approriate session in the db if it finds a valid cookie
// object param for session() is the session setup
// secret is used for signing the hash which secretly stores our ID in the cookie (should be a long string)
// A session secret in connect is simply used to compute the hash.
// resave: false --> the session will not be saved on every request that is done, will only change if something changed in the session
// saveUnitialized: false --> ensures that no session gets saved for a request where it doesnt need to be saved
/*If during the lifetime of the request the session object isn't modified then, at the end of the request and when saveUninitialized is false, the (still empty, because unmodified) session object will not be stored in the session store.
The reasoning behind this is that this will prevent a lot of empty session objects being stored in the session store. Since there's nothing useful to store, the session is "forgotten" at the end of the request. */
// can also configure cookie here
// this middleware adds the "session" object to the request object
app.use(
  session({
    secret: "my secret",
    resave: false,
    saveUninitialized: false,
    // set the store property to the session management object created
    store: store,
  })
);

// must be registered after we register the session
// For any non “get” request, this package will look for the existence
// of a csrf token in the request body (ONLY POST REQUESTS HAVE A REQUEST BODY)
app.use(csrfProtection);

app.use(flash());

app.use((req, res, next) => {
  // now for every request that is sent, these two fields will be set for the
  // views that are rendered in the response when we call res.render() --> can access
  // these two variables in our views

  // special .locals field on response
  // allows us to set local variables that are passed into all the views
  // local: only exist in the views which are rendered
  // console.log(req.session);
  // console.log(req.session.isLoggedIn);
  res.locals.isAuthenticated = req.session.isLoggedIn;
  // provided by csrf middleware that generates a random token
  // A new token is generated for EVERY response sent back to the client
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Makes sure we have a "user" mongoose object for EVERY request
// so we can call the mongoose methods on it ==> lecture 244
// For every NEW request, the session middleware DOES NOT fetch the user with the help of mongoose/sequelize
// when we call "req.session.user", it just fetches it from mongodb/mysql
// Thus, the express-session will ONLY fetch the data and NOT a mongoose/sequelize object with all the helper methods
app.use((req, res, next) => {
  // if we are NOT logged in
  if (!req.session.user) {
    return next();
  }

  User.findById(req.session.user._id)
    .then((user) => {
      // make sure the user exists (possible user
      // has been deleted from the database)
      if (!user) {
        return next();
      }

      // user will NOW be a mongoose object with helper methods
      // as it was fetched by a mongoose model
      req.user = user;
      next();
    })
    .catch((err) => {
      // throwing an error inside a async code like promises here
      // will not allow us to reach our express handling middleware
      // throw new Error(err);

      // instead do this
      next(new Error(err));
    });
});

app.use("/admin", isAuth, adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get("/500", errorController.get500);

// catch-all middleware that will run if all other routes fail
app.use(errorController.get404);

// define a special error handling middleware that has 4 args
// Express will move right away to the first error handling middleware (goes from top to bottom
// among error handling middlewares) whenever we call next(error) (next with an error object passed to it)
app.use((error, req, res, next) => {
  // whenever we have an error, console log it here
  console.log(error);
  res.status(500).render("500", {
    pageTitle: "Error!",
    path: "/500",
  });
});

mongoose
  .connect(MONGODB_URI)
  .then((result) => {
    // all hosting providers will automatically inject the PORT environment variable
    // For local development, we will fall back to port 3000
    app.listen(process.env.PORT || 3000);
  })
  .catch((err) => {
    console.log(err);
  });
