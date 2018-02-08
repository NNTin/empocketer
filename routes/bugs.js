// require and assign packages
'use strict';
const nodemailer = require('nodemailer');

var express = require('express');
var router = express.Router();
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
var settings = require('../settings');

router.get('/', ensureLoggedIn('/'), function(req, res) {
	res.render('bugs', {
		appname: settings.APP_NAME,
		title: settings.APP_NAME + ' - bugs',
	});
})

router.post('/sendbug', function(req, res) {
	console.log(req.body.report)

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
		text: req.body.report
	}

	transporter.sendMail(mailOptions, (error, info) => {
		if (error) {
			return console.error(error);
		}
		console.log(`Message sent: ${mailOptions.text}`)
	})

	res.render('thanks', {
		appname: settings.APP_NAME,
		title: settings.APP_NAME + ' - thanks for the bugs',
	});
})

module.exports = router;