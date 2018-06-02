// require
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var db = require('./nedb.js');
// routes
var index = require('./routes/index');
var dashboard = require('./routes/dashboard');
var lists = require('./routes/lists');
var auth = require('./routes/auth');
var del = require('./routes/del');
var bugs = require('./routes/bugs');
var todos = require('./routes/todos');
var api = require('./routes/api');
var settings = require('./settings');
// *******************************
// SESSION                       *
// *******************************

// use cookie-parser and express-session
// this comes partially from https://www.raymondcamden.com/2017/02/08/using-social-login-with-passport-and-node/
// the official Passport docs are ...not great

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var passport = require('passport');
var PocketStrategy = require('passport-pocket');
var app = express();
app.use(cookieParser(settings.COOKIE_SECRET));
app.use(session(settings.SESSION_PARAMS));
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.json()); // for parsing application/json

// *******************************
// POCKET AUTHENTICATION         *
// *******************************

// Passport Set up
var pocketStrategy = new PocketStrategy({
		consumerKey    : settings.POCKET_CONSUMER_KEY,
		callbackURL    : `${settings.ROOT_URL}/auth/pocket/callback`
	},function(username, accessToken, done) {
    // here we add logic to upsert the user
    db.users.update({pocket_name: username}, {$set: {pocket_name: username, pocket_token: accessToken}}, {upsert: true}, function(err, num, data, upsert) {
      // Call done **and include object with user info** - this is how we retreive the user in Serialize / Deserialize
      done(null, {username: username});
    })
});
// passport authorisation
passport.use(pocketStrategy);

// serialise
// this stores the user data in RAM for use when we deserialise
passport.serializeUser(function(user, done) {
  console.log(`user: ${user} is logged in with username ${user.username}`)
  done(null, user.username);
});

// deserialise: this allows us to retrieve the user from the DB using 'doc' which, since we serialised it this way, is user.username i.e. the Pocket username.
passport.deserializeUser(function(user, done) {
  db.users.findOne({pocket_name: user}, function(err, doc){
    if (err) {return 'Ah shit, ', err};
    done(err, doc)
  })
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('partials', path.join(__dirname, 'views/partials'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
// use routes
app.use('/', index);
app.use('/auth', auth);
app.use('/dashboard', dashboard);
app.use('/del', del);
app.use('/lists', lists);
app.use('/bugs', bugs);
app.use('/todos', todos);
app.use('/api', api);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
