var express = require('express');
var router = express.Router();
var settings = require('../settings');

router.get('/', function(req, res){
	res.render('todos', {
		appname: settings.APP_NAME,
		title: settings.APP_NAME + ' - todos',
	});
})

module.exports = router;