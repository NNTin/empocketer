var express = require('express');
var router = express.Router();
var passport = require('passport');
var settings = require('../settings');
var db = require('../nedb.js');

router.get('/', function(req, res){

	// get user details
	if (req.session && req.session.passport && req.session.passport.user) {
		db.users.findOne({pocket_name: req.session.passport.user}, function(err, doc){
			if (err) {return console.error('oh no, error! \n' + err)}
			renderPage(doc)
		});
	} else {
    renderPage()
  }
	function renderPage(user) {
		res.render('todos', {
			appname: settings.APP_NAME,
			title: settings.APP_NAME + ' - todos',
			user: user
		});
	}
})

module.exports = router;