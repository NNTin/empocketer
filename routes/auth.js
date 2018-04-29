var express = require('express');
var router = express.Router();
var passport = require('passport');

router.get('/', function(req, res, next) {
  res.redirect('/auth/pocket');
});

// Passport routes for express
router.get('/pocket',passport.authenticate('pocket', {successReturnToOrRedirect: '/dashboard', failureRedirect: '/error'}), function(req, res){
  // res.redirect('/dashboard')
  // this should not be called, because Passport sends them to Pocket and then /pocket/callback
});

// NOTE Using the instructions from passport-pocket, if you click 'no thanks' in the Pocket authentication, the redirects don't work here but it also doesn't render anything: seemingly because passport/session still sets a cookie. And then you can never log in unless you clear the cookie!

// To fix this, we have to create a custom callback function (as described in the Passport docs) and clear the cookie if there is no user.

// be careful **NOT** to RETURN on an error: the login failing because there is no user IS an error: so this will just kill your app. Alternatively, you could clear the cookie and then return an error route if you wanted.
router.get('/pocket/callback', function(req, res, next) {
  passport.authenticate('pocket',function(error, user, info) {
    if (error) {
      let now = new Date(Date.now());
      console.error('LOGIN ERROR at ' + now.toUTCString() + '\n' + error)
    }
    if (!user) {
      console.error('user did not authenticate')
      // clear the cookie if there is no user
      res.clearCookie('empocketer', {path: '/'});
      return res.redirect('/');
    }
    req.login(user, function(err) {
      if (err) {return next(err)};
      return res.redirect('/dashboard')
    });
  })(req, res, next);
});

module.exports = router;