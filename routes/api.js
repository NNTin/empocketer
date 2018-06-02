'use strict'

// require and assign packages
var express = require('express');
var router = express.Router();
var passport = require('passport');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
var settings = require('../settings');
var multer = require('multer');
var bodyParser = require('body-parser');
var upload = multer({ dest: 'uploads/' });
var fs = require('fs');
const uuid = require('uuid');
// require local files
var getlists = require('../getlists');
var db = require('../nedb.js');
var pf = require('../pocketfeeds');
var ef = require('../empocketer_functions');

// ******************
// *                *
// * USEFUL METHODS *
// *                *
// ******************

// get logged in user
// wrap the DB call up in a promise
function getUser(pUser) {
  if (pUser) {
    return new Promise((resolve, reject) => {
      db.users.findOne({pocket_name: pUser}, function(err, doc){
        if (err) {
          console.error('error finding user in lists.js line 14 \n' + err);
          reject(console.error(`error \n err`));
        } else if (!doc) {
          reject(console.error('cannot find user \n ' + err))
        } else {
          resolve(doc);
        }
      });
    });
  } else {
    reject(console.log(`error`))
  }
};

function upsertNewFeed(data) {
  db.feeds.update({feed: data.feed}, {$set:{feed: data.feed, url: data.url, title: data.title}}, {upsert: true}, function(err, num, doc, upsert){
    if (data.error) {
      // send to error page
      return res.redirect(`/lists/${userId}/${list}/error/${err}`) // TODO update this URL
    } else {
      if (doc == undefined){
        // it was already in the DB, but maybe not in this list
        // TODO check if the feed is already in this list, and throw an error message to messages.
        // at the moment it simply reloads the page but there is no UI indication why basically nothing happened.
      } else {
        console.log(`added feed: ${doc._id}`)
      }
      // now add the list to the lists array if it is not already there
      // we have to do this because we can't '$addToSet' inside '$set'
      // TODO this should be a totally different function - needs LIST
      db.feeds.update({feed:data.feed}, {$addToSet: {lists: list}}, {upsert: true}, function(err, num, doc){
        if (err) {
          return res.redirect(`/lists/${userId}/${list}/error/${err}`) // TODO: update this URL
        }
        res.redirect(`/dashboard`); // TODO update this to an AJAX return of a JSON object for the affected list so we can update state? Or do that before the DB call?
      });
    }
  })
}

// ******************
// *                *
// *     ROUTES     *
// *                *
// ******************

// edit list
// possible params: list, name, description, tags, public

router.post('/v1/edit-list', ensureLoggedIn('/'), function(req, res){
	getUser(req.session.passport.user)
  .then(user => {
    db.lists.findOne({_id: req.body._id}, function(err, docs) {
      // make sure the list belongs to the logged in user
      if (user._id === docs.owner) {
        // get values to change: if they're null, 'update' using the value already in the DB
				const name = (req.body.name != undefined) ? req.body.name : docs.name;
				const description = (req.body.description != undefined) ? req.body.description : docs.description;
				const tags = (req.body.tags !=undefined) ? req.body.tags : docs.tags;
				const privacy = (req.body.public !=undefined) ? req.body.public : docs.public;
        db.lists.update({_id: req.body._id}, {$set: {name: name, description, description, tags: tags, public: privacy}}, {returnUpdatedDocs: true}, function(err, num, updatedDocs, upsert){
          if (err) return console.error(err);
          // return the list document so react state can be updated in the client
          return res.json(updatedDocs)
        })
      }
    })
  })
	.catch(e => {
		console.error(e)
	})
})

// add site (i.e. using site URL)
// v1/add-site (url, title, list, user)

// TODO: there really should be a check of ' if (user._id === docs.owner) ' against the list to ensure that you can't add feeds to other people's lists (i.e. ensureLoggedIn only checks if you're logged in, not if you're working on your own data)
router.post('/v1/add-site', ensureLoggedIn('/'), function(req, res){
	getUser(req.session.passport.user)
  // TODO need to check the site first here using pocketfeeds.checkUrl
  // checkUrl should be Promisified so we can do pf.checkUrl(...).then(...)
  // as should the updates below. then we can do:
  // if (url)
  // pf.checkUrl
  // .then(upsertNewFeed)
  // .then(addListToFeed)
  // or we can do:
  // if (feed)
  // pf.checkFeedUrl
  // .then(upsertNewFeed)
  // .then(addListToFeed)
  // and then potentially in future you could add a feed from someone else's list to your list by just using:
  // addListToFeed(list, feed)
  ef.getFeedInfoFromURL(req.body.url)
  .then( (args) => {
    args.list = req.body.list;
    // if the user provided a name for the feed, use that, otherwise use what the URL provides.
    // WARNING will need to refactor lists array to be an array of objects with both a list ID and a title for the feed because different users might call the same feed different things
    args.title = req.body.name ? req.body.name : args.title;
    return args
  })
  .then(ef.upsertNewFeed)
  .then(ef.addListToFeed)
});

// add feed (i.e. using feed URL)
// v1/add-feed (url, title, list, user)

module.exports = router;