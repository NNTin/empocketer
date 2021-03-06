'use strict'
// require and assign packages
var express = require('express');
var router = express.Router();
var passport = require('passport');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
var settings = require('../settings');
var multer = require('multer');
var upload = multer({ dest: 'uploads/' });
var fs = require('fs');
const uuid = require('uuid');
// require local files
var getlists = require('../getlists');
var db = require('../nedb.js');
var pocketfeeds = require('../pocketfeeds');

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

/* GET list of lists. */
router.get('/', ensureLoggedIn('/'), function(req, res, next) {

  // wrap the DB call up in a promise
  function getLists() {
    return new Promise((resolve, reject) => {
      //TODO once finished testing, restrict this to public: true
      db.lists.find({}).sort({name: 1, subscribers: -1}).exec(function(err, docs) {
        try {
          // resolve promise with the updated docs array after the for..of is done
          resolve(docs);
        } catch (err) {
          reject(console.log(`error getting lists with getAllLists\n${err}`));
        }
      })
    })
  } // end getLists

  // wrap the DB call up in a promise
  function addFeeds(list){
    return new Promise((resolve, reject) => {
      db.feeds.find({lists: list._id}, function (err, feeds) {
        try {
          // simple assignment here will update docs
          list.feeds = feeds;
          // TODO SECURITY replace user tokens with just a number of subscribers
          resolve(list)
        } catch (err) {
          reject(console.error(`error finding feeds in getAllLists\n${err}`))
        }
      })
    })
  }

  async function updateLists() {
    // get each list and add the feeds
    // use for..of here, not forEach
    // see https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop?rq=1
      const lists = await getLists();
      for (let list of lists) {
        const newList = await addFeeds(list)
        list = newList;
      }
      return lists;
  } // end addFeeds

  // wrap the DB call up in a promise
  async function attachOwner(list) {
    return new Promise((resolve, reject) => {
      // get the user with this ID
      db.users.findOne({_id: list.owner}, function(err, user){
        try {
          //add their name as ownerName
          //TODO this should replace the list owner ID with their name rather than adding a new field (SECURITY)
          list.ownerName = user.name;
          resolve(list)
        } catch (e) {
          reject(e);
        }
      })
    })
  } // end attachOwner

  // this takes the updated lists array as input, attaches a name for each owner id, and returns the new array
  async function attachOwners(){
    let ls = await updateLists();
    for (let list of ls) {
      const listWithName = await attachOwner(list);
      list = listWithName;
    }
    return ls;
  }

  // use final async function to render the page once all the data is ready
  async function renderLists(pUser) {
    let user = await getUser(pUser); // get username for header
    // let lists = await attachOwners(); // updated lists once they're ready
    let lists = await getlists.byname({});
    // wrap up both promises in a new one and once it's ready, render page;
    Promise.all([user, lists]).then(function(vals){
      // here we update each list to show whether the currently logged in user subscribes to it.
      // this is used to make sure the 'subscribed/unsubcribed' indicator is correct
      for (let list of vals[1]) {
        if (list.subscribers.includes(vals[0].pocket_token)) {
          list.subscribed = true;
        } else {
          list.subscribed = false;
        }
      }
      // here we add a field to indicate that the current user is the owner of the list
      // we can't calculate that easily with a client-side script and it's safer to do it here
      // we prevent owners seeing the subscribe/unsubscribe button in the page template
      for (let list of vals[1]) {
        if (list.owner === user._id) {
          list.mylist = true;
        }
      }
      res.render('lists', {
        user: vals[0], //vals[0] is the result of the user promise
        appname: settings.APP_NAME,
        title: settings.APP_NAME + ' - lists',
        lists: vals[1] // vals[1] is the result of the lists promise
      });
    })
  }
  // kick it all off
  renderLists(req.session.passport.user)
})

// remove feed and report back to page
router.get('/removefeed/list:list/feed:id', ensureLoggedIn('/'), function(req, res){
  var id = req.params.id;
  var listId = req.params.list;
  // get the feed, then remove this list from the feed's lists array
  db.feeds.findOne({_id: id}, function(err, doc){
    // if it is the only list in the array, remove the feed altogether
    console.log('id is ' + id)
    if (doc.lists.length < 2) {
      try {
        db.feeds.remove({_id: id}, {}, function(err, num) {
          console.log(`removed ${num} document from feeds`)
          // send result
          res.json({result: 'success'});
        })
      } catch (err) {
        //log to console, the result will be sent as 'error'
        console.error(`error removing feed ${id} from list ${listId}. This is the only list with this feed.\n${err}`)
        // send result
        res.json({result: 'error'});
      }
    } else {
      try {
        // pull the listId from the lists array
        db.feeds.update({_id: id}, {$pull:{lists: listId}}, {}, function(err, num){
          console.log(`pulled ${num} lists from the array in ${id}`)
          // send result
          res.json({result: 'success'});
        })
      } catch (err) {
        //log to console, the result will be sent as 'error'
        console.error(`error removing feed ${id} from list ${listId}. There are other lists with this feed also.\n${err}`)
        // send result
        res.json({result: 'error'});
      }
    }
  })
});

// show errors
router.get('/:userId/:listId/error/:err', ensureLoggedIn('/'), function(req, res){
  var error, exists;
  if (req.params.err === "EXISTS") {
    error = "this site is already on your list!";
    exists = false;
  } else if (req.params.err === "NOFEED") {
    error = "the site does not have an RSS or Atom feed listed in the HEAD.";
    exists = true;
  } else if (req.params.err === "NOSITE") {
    error = "that URL does not appear to exist. Please check the URL and try again.";
    exists = false;
  }else {
    error = req.params.err;
  }
  // get user details
	if (req.session && req.session.passport && req.session.passport.user) {
		db.users.findOne({pocket_name: req.session.passport.user}, function(err, doc){
			if (err) {return console.error('oh no, error! \n' + err)}
			renderPage(doc)
		});
  } else {
    renderPage(req.params.userId)
  }
  function renderPage(user){
    res.render('feed-error', {
      user: user,
      appname: settings.APP_NAME,
  		title: settings.APP_NAME + ' - error with feed',
      error: error,
      exists: exists,
      link: `/lists/${req.params.userId}/${req.params.listId}`,
      owner: req.params.userId,
      list: req.params.listId
    });
  }
});


// GET for adding feeds
router.get('/:userId/list:listId/addfeed', ensureLoggedIn('/'), function(req, res){
  var userId = req.params.userId;
  var list = req.params.listId;
  pocketfeeds.checkUrl(req.query.feedUrl, function(err, data) {
    if (err) {
      console.error(err)
      // send to error page
      res.redirect(`/lists/${userId}/${list}/error/${err}`);
    }
    else {
      var url = req.query.feedUrl,
          feed = data.feed, // fetch from url
          title = data.title; // fetch from url
      // add to list of feeds
      console.log(`updating feed info with ${feed}, ${url}, ${title}`)
      db.feeds.update({feed: feed}, {$set:{feed: feed, url: url, title: title}}, {upsert: true}, function(err, num, doc, upsert){
        if (err) {
          // send to error page
          return res.redirect(`/lists/${userId}/${list}/error/${err}`)
        } else {
          if (doc == undefined){
            // it was already in the DB, but maybe not in this list
            // TODO check if the feed is already in this list, and throw an error.
            // at the moment it simply reloads the page but there is no UI indication why basically nothing happened.
          } else {
            console.log(`added feed: ${doc._id}`)
          }
          // now add the list to the lists array if it is not already there
          // we have to do this because we can't '$addToSet' inside '$set'
          db.feeds.update({feed:feed}, {$addToSet: {lists: list}}, {upsert: true}, function(err, num, doc){
            if (err) {
              return res.redirect(`/lists/${userId}/${list}/error/${err}`)
            }
            res.redirect(`/dashboard`);
          });
        }
      });
    }
  });
});

// for adding feed directly from the error page
router.post('/:ownerid/:listid/addfeeddirectly', ensureLoggedIn('/'), function(req, res){
  var user = req.params.ownerid;
  var list = req.params.listid;
  var feed = req.body.url;

  pocketfeeds.checkFeed(feed, function(err, data) {
    try {
      // update the DB
      db.feeds.update({feed:feed}, {$set: {feed: feed, url: data.url, title: data.title}}, {upsert: true}, function(err, num, doc){
          db.feeds.update({feed:feed}, {$addToSet: {lists: list}}, {upsert: true}, function(err, num, doc){
            res.redirect(`/dashboard`);
          });
      });
    } catch (e) {
      console.log(`there was an error\n${e}`)
      // Update user messages with an error
      const text = `Error with ${feed} when attempting to add feed manually.\nEmpocketer just doesn't like this feed :-(`
      const code = err;
      const now = new Date();
      db.users.update({pocket_name: req.session.passport.user}, {$push: {messages: {id: uuid.v4(), text: text, code: code, time: now}}}, {upsert: true}, function() {
        console.log('updated')
      });
      res.redirect('/dashboard')
    }
  })
});

// toggle publicness of lists
// this is now superseded buy the router.get underneath
router.post('/toggle/owner:owner-list:id/:pub', ensureLoggedIn('/'), function(req, res){

  getUser(req.session.passport.user).then((user) => {
    let uID = user._id;
    let listID = req.params.id;
    let owner = req.params.owner;
    let pub = req.params.pub;
    // pub is a string, so we need to make it a boolean
    if (pub === "true") {pub = true} else pub = false;
    if (uID === owner){
      db.lists.update({_id: listID}, {$set: {public: pub}}, {}, function(err, num) {
        console.log(num)
      })
    } else {
      res.send('Permission Denied')
    }
  });
});

router.get('/toggle/id:id', ensureLoggedIn('/'), function(req, res){
  getUser(req.session.passport.user)
  .then(user => {
    db.lists.findOne({_id: req.params.id}, function(err, docs) {
      // make sure the list belongs to the logged in user
      if (user._id === docs.owner) {
        // flip the privacy value
        db.lists.update({_id: req.params.id}, {$set: {public: !docs.public}}, {returnUpdatedDocs: true}, function(err, num, updatedDocs, upsert){
          if (err) return console.error(err);
          // return the list document so react state can be updated in the client
          return res.json(updatedDocs)
        })
      }
    })
  })
});

// toggle subscriptions
router.post('/subscribe/list:id-:sub', ensureLoggedIn('/'), function(req, res){
  getUser(req.session.passport.user).then((user) => {
    let listID = req.params.id;
    let sub = req.params.sub;
    let token = user.pocket_token;
    // listID is a string, so we need to make it a boolean
    if (sub === "true") {
      db.lists.update({_id: listID}, {$push: {subscribers: token}}, {}, function(err, num) {
        if (err) {
          console.log(err)
        } else {
          console.log(num)
        }
      })
    } else {
      db.lists.update({_id: listID}, {$pull: {subscribers: token}}, {}, function(err, num) {
        if (err) {
          console.log(err)
        } else {
          console.log(num)
        }
      });
    }
  });
});

// add list via OPML file
// uses multer and opmltojs
router.post('/opml', ensureLoggedIn('/'), upload.single('opmlfile'), function(req, res){
  // read the file that multer created (req.file.path)
  fs.readFile(req.file.path, 'utf-8', function (err, data) {
    // process the opml file
    pocketfeeds.processOpml(req, data, function(x) {
      // log done when done
      console.log(x)
      // delete the file now we're done with it.
      fs.unlink(req.file.path, (err) => {
        if (err) throw err;
        console.log('file deleted');
      })
      res.redirect('../dashboard')
    })
  });
});

//clone list
router.get('/clone/', ensureLoggedIn('/'), function(req, res) {
  // get the user
  getUser(req.session.passport.user).then((user) => {
    // get the new name and old id from the submitted query
    const name = req.query.listName;
    // remove the 'clone' from the beginning of the ID
    const id = req.query.listToClone.slice(5);

    function listFeeds(list) {
      return new Promise((resolve, reject) => {
        db.feeds.find({lists: list}, function(err, array) {
          let feeds = array.map(feed => feed._id)
          if (err) {
            console.log(`error\n${err}`)
          } else {
            resolve(feeds)
          }
        })
      })
    }

    function getFeeds(feeds) {
      db.lists.findOne({_id: id}, function(err, list) {
        let newList = {name: name, owner: user._id, public: false, subscribers: [user.token]}
        db.lists.insert(newList, function(err, doc) {

          const promises = feeds.map(feed => updateFeedWithList(feed));

          function updateFeedWithList(feed) {
            return new Promise((resolve, reject) => {
              db.feeds.update({_id: feed}, {$push:{lists: doc._id}}, {upsert: true}, function(err, num, result, upsert) {
                if (err) {
                  console.error(err)
                } else {
                  resolve();
                }
              })
            })
          }
          Promise.all(promises)
        })
      })
    }
    // bombs away!
    listFeeds(id)
    .then(getFeeds)
    .then(() => res.redirect('/dashboard'))
  });
})

module.exports = router;
