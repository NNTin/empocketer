var express = require('express');
var router = express.Router();
var passport = require('passport');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn; // might have been nice for this to be in the README 🙄
var settings = require('../settings');
//DB
var db = require('../nedb.js')
// requrie local files
var getlists = require('../getlists');
// var pocketfeeds = require('../pocketfeeds');

/* render the dashboard if logged in, or render the index/homepage if not logged in. */
router.get('/',
  ensureLoggedIn('/'), //this '/' redirect refers to the root of the site, not this route
  //get the passport session user (Pocket username) and use it to find the logged in user from the database
  function(req, res, next) {
    function getUser() {
      db.users.findOne({pocket_name: req.session.passport.user}, async function(err, doc){
        if (err) {return console.error('oh no, error! \n' + err)}
        var user = doc;
        const lists = await getlists.byname({owner: user._id});
        getFeeds(user, lists)
      })
    };

    // called by getUser, here we're checking whether there are any feeds in the user lists
    // this is so we can make onboarding easier by showing a hint if the user hasn't added any feeds yet.
    function getFeeds(user, lists) {
      // we use Promises and async/await because otherwise the function will return before we have time to check the database and loop through the lists.

      // the Promise comes from checking the database
      function checkFeeds(list) {
        return new Promise((resolve, reject) => {
          db.feeds.findOne({lists: list._id}, function(err, doc){
            if (err) {
              reject(console.error(err))
            } else if (doc) {
              resolve(true)
            } else {
              resolve(false)
            }
          })
        })
      };

      // loop through each list, and await the DB check
      async function checkLists(lists) {
        for (const list of lists) {
          var hasFeed = await checkFeeds(list);
          if (hasFeed) {
            return true
            break;
          } // else just don't do anything
        }
      }

      // await the loop so it has a chance to finish running before rending the page
      async function waitForFeeds(){
        let feeds = await checkLists(lists);
        let subscriptions = await getlists.byname({$not: {owner: user._id}, subscribers: user.pocket_token})
        // if there are any feeds for this user, checkLists will return true and then break the loop;
        // if there are no feeds, checkists returns nothing, so feeds will be undefined (i.e. falsy)
        myRender(user, lists, feeds, subscriptions)
      }
      // here's the trigger to start everything
      waitForFeeds();
    }

    // this is called by the getUser function so all the values are already retrieved
    function myRender (user, lists, feeds, subscriptions) {

      res.render('dashboard', {
        appname: settings.APP_NAME,
    		title: settings.APP_NAME + ' - dashboard',
        user: user,
        lists: lists,
        feeds: feeds,
        subscriptions: subscriptions
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
router.get('/addlist/', ensureLoggedIn('/'), function(req, res, next) {

  // get the current user
  db.users.findOne({pocket_name: req.session.passport.user}, function(err, doc) {
    if (err) {return res.json({result: 'fail'})};
    var owner = doc._id, subscriber = doc.pocket_token;
    // get the data from the form and update the lists
    var listName = req.query.listName; //TODO we need to sanitise this
    var doc = {name: listName, owner: owner, public: false, subscribers: [subscriber]}
    db.lists.insert(doc, function(err, newDoc) {
      if (err) {return res.json({result: 'fail'})};
      console.log('inserted ' + newDoc);
      // res.json({result: 'success', list: newDoc});
      res.redirect('/dashboard');
    });
  })
})
module.exports = router;
