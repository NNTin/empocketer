var express = require('express');
var router = express.Router();
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn; // might have been nice for this to be in the README 🙄
var settings = require('../settings');

/* GET users listing. */
router.get('/',
  ensureLoggedIn('/'),
  function(req, res, next) {
  res.send('this will be the page where you delete your account');
});

module.exports = router;
