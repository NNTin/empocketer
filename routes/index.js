var express = require('express');
var router = express.Router();
var passport = require('passport');
var settings = require('../settings');
var db = require('../nedb.js');

/* GET home page. */
router.get('/', function(req, res, next) {
  // get user details
	if (req.session && req.session.passport && req.session.passport.user) {
		db.users.findOne({pocket_name: req.session.passport.user}, function(err, doc){
			if (err) {return console.error('oh no, error! \n' + err)}
			renderPage(doc)
		});
	} else {
    renderPage()
  }
  function renderPage(user){
    res.render('index', {
      appname: settings.APP_NAME,
      title: settings.APP_NAME,
      user: user
    });
  }
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