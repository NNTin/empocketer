var express = require('express');
var router = express.Router();
var passport = require('passport');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn; // might have been nice for this to be in the README 🙄
var settings = require('../settings');
//DB
var db = require('../nedb.js')

/* render the dashboard if logged in, or render the index/homepage if not logged in. */
router.get('/',
  ensureLoggedIn('/'), //this '/' redirect refers to the root of the site, not this route
  //get the passport session user (Pocket username) and use it to find the logged in user from the database
  function(req, res, next) {
    function getUser() {
      db.users.findOne({pocket_name: req.session.passport.user}, function(err, doc){
        if (err) {return console.error('oh no, error! \n' + err)}
        var user = doc;
        db.lists.find({owner: user._id}).sort({name:1}).exec(function(err, lists) {
          try {
            myRender(user, lists)
          } catch (err) {
            console.error(`error getting lists... \n ${err}`)
          }
        })
      })
    };
    // this is called by the getUser function so all the values are already retrieved
    function myRender (user, lists) {
      res.render('dashboard', {
        appname: settings.APP_NAME,
    		title: settings.APP_NAME + ' - dashboard',
        user: user,
        lists: lists
      });
    };
    // get user data
    getUser()
});

// delete a list
router.get('/removelist/list:id', ensureLoggedIn('/'), function(req, res){
  var id = req.params.id;
  // this is called further down
  // if the user deletes a list that has feeds that only appear in that list, we should delete them to keep the database up to date and avoid making RSS calls uneccessarily.
  function cleanUpFeeds(feedId) {
    db.feeds.findOne({_id: feedId}, function(err, doc){
      if (err) {
        console.error(`ERROR CLEANING FEEDS \n $(err)`)
      }
      if (doc.lists.length === 0) {
        db.feeds.remove({_id: feedId}, function(err, num){
          if (err) {
            return console.error(`error removing unsubscribed feed ${feedId}`)
          }
          console.log(`${num} unsubscribed feeds deleted`)
        })
      }
    })
  }

  // start by finding feeds with this list
  db.feeds.find({lists: id}, function(err, docs){
    try {
      // only try to remove feeds if there actually are some
      if (docs.length > 0) {
        // remove list from all feeds that have it listed
        for (i = 0; i < docs.length; i++) {
          var feed = docs[i]._id;
          db.feeds.update({_id: feed}, {$pull:{lists: id}}, {returnUpdatedDocs: true, multi: false}, function(err, num, doc){
            if (err) {
              return console.error('ERROR PULLING LIST \n' + err)
            }
            // doc.title is undefined. why?
            console.log(`deleted list ${id} from feed ${doc.title}`);
            // check if this is the only list the feed appears in
            cleanUpFeeds(doc._id)
          });
        }
      }
      // then remove list
      db.lists.remove({_id: id}, function(err, numRem){
        console.log(`removed ${numRem} lists`)
        res.json({result: 'success'});
      })
    } catch (err) {
      //do something with error
      console.error(`error removing list ${id} \n ${err}`)
      res.json({result: 'failure'});
    }
  })
});

// POST - this grabs the data entered in the form at /dashboard
//editing user name
router.post('/addname', ensureLoggedIn('/'), function(req, res, next) {
  // get the data from the form and update the user record
  var userName = req.body.name.toString(); //TODO do we need to sanitise this a bit more?
  db.users.update({pocket_name: req.session.passport.user}, {$set: {name: userName}}, {}, function(err, num) {
    if (err) {return console.error("shit \n" + err)};
    console.log('replaced ' + num)
  });
  res.redirect('/dashboard');
})

// adding a new list
router.post('/addlist', ensureLoggedIn('/'), function(req, res, next) {
  // get the current user
  db.users.findOne({pocket_name: req.session.passport.user}, function(err, doc) {
    if (err) {return console.error("shit \n" + err)};
    var owner = doc._id, subscriber = doc.pocket_token;
    // get the data from the form and update the lists
    var listName = req.body.list.toString(); //TODO do we need to sanitise this a bit more?
    var doc = {name: listName, owner: owner, public: false, subscribers: [subscriber]}
    db.lists.insert(doc, function(err, newDoc) {
      if (err) {return console.error("shit \n" + err)};
      console.log('inserted ' + newDoc)
    });
  })
  res.redirect('/dashboard');
})
module.exports = router;
