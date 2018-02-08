var express = require('express');
var router = express.Router();
var passport = require('passport');
var settings = require('../settings');

/* GET home page. */
router.get('/', function(req, res, next) {
  if ( req.session && req.session.passport && req.session.passport.user) {
    var user = req.session.passport.user;
  }
  res.render('index', {
    appname: settings.APP_NAME,
    title: settings.APP_NAME,
    user: user
  })
});

// Logout
router.get('/logout', function(req, res){
  //this logs the user out of the app but doesn't clear the cookie
  req.logout();
  // we have to clear cookie manually. Thanks passport 😒
  res.clearCookie('empocketer', {path: '/'});
  res.redirect('/');
});

module.exports = router;