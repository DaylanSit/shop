// middleware which can be added on every route that should be protected

module.exports = (req, res, next) => {
  // before we render this page, ensure that the user is authenticated (route protection)
  if (!req.session.isLoggedIn) {
    return res.redirect("/login");
  }
  // otherwise, if user is logged in, go to next middleware
  next();
};
