// require and assign packages

const nodemailer = require('nodemailer');

var express = require('express');
var router = express.Router();
var passport = require('passport');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
var settings = require('../settings');
var db = require('../nedb.js');

router.get('/', ensureLoggedIn('/'), function(req, res) {
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
		res.render('bugs', {
			appname: settings.APP_NAME,
			title: settings.APP_NAME + ' - bugs',
			user: user
		});
	}
})

router.post('/sendbug', function(req, res) {

	// get user details
	if (req.session && req.session.passport && req.session.passport.user) {
		db.users.findOne({pocket_name: req.session.passport.user}, function(err, doc){
			if (err) {return console.error('oh no, error! \n' + err)}
			sendTheBug(doc)
		});
	} else {
    res.redirect('/');
  }

	function sendTheBug(user){
		let transporter = nodemailer.createTransport({
			host: settings.EMAIL_HOST,
			port: 587,
			secure: false,
			auth: {
				user: settings.EMAIL_USER,
				pass: settings.EMAIL_PASSWORD
			}
		});

		let mailOptions = {
			from: settings.EMAIL_FROM,
			to: settings.EMAIL_TO,
			subject: 'bug report',
			text: `${req.body.report} \n Sent By: ${user.name} (${user._id})`
		}

		transporter.sendMail(mailOptions, (error, info) => {
			if (error) {
				return console.error(error);
			}
			console.log(`Message sent: ${mailOptions.text}`)
			renderPage()
		})

		function renderPage(){
			res.render('thanks', {
				appname: settings.APP_NAME,
				title: settings.APP_NAME + ' - thanks for the bugs',
				user: user
			});
		};
	};
})

module.exports = router;