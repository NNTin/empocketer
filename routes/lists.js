// require and assign packages
var express = require('express');
var router = express.Router();
var passport = require('passport');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn; // might have been nice for this to be in the README 🙄
var settings = require('../settings');
// require local files
var pocketfeeds = require('../pocketfeeds');
var db = require('../nedb.js');

/* GET users listing. */
router.get('/',
  ensureLoggedIn('/'),
  function(req, res, next) {
  res.send('this will be the lists page');
});

// remove feed and report back to page
router.get('/removefeed/list:list-:id', ensureLoggedIn('/'), function(req, res){
  var id = req.params.id;
  var listId = req.params.list;
  // get the feed, then remove this list from the feed's lists array
  db.feeds.findOne({_id: id}, function(err, doc){
    // if it is the only list in the array, remove the feed altogether
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
    renderPage()
  }
  function renderPage(user){
    res.render('feed-error', {
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


// when the user clicks on a list (either from /lists or /dashboard)
// it will take them to /lists/userId/listId
// this is rendered as per below
// userId and listId are stored by Express in req.params automatically
router.get('/:userId/:listId', ensureLoggedIn('/'), function(req, res, next){
  // TODO fix this to actually call DB, and provide an if...else that shows a special 404 if the listId doesn't exist.

  function getOwner(owner, list){
    db.users.findOne({_id: owner}, function(err, user){
      if (err) {
        return console.error(err) //TODO something more useful to handle owner errors
      } else {
        getListName(user.name, list)
      }
    })
  };

  function getListName(owner, list){
    db.lists.findOne({_id: list}, function(err, data){
      if (err) {
        return console.error(err) //TODO something more useful to handle owner errors
      } else {
        getFeeds(owner, list, data.name)
      }
    })
  };

  function getFeeds(owner, list, name){
    // find all feeds there this list is included in the feed's 'lists' array
    db.feeds.find({lists: list}, function(err, feeds){
      if (err) {
        return console.error(err) //TODO something more useful to handle owner errors
      } else {
        // if there is only one feed, the user has *probably* only just started adding them. Show a hint that they will get the next post in their Pocket account.
        if (feeds.length > 1) {
          renderList(owner, list, name, feeds, false)
        } else {
          renderList(owner, list, name, feeds, true)
        }
      }
    })
  }

  function renderList(owner, list, name, feeds, firstFeed){
    // get user details
  	if (req.session && req.session.passport && req.session.passport.user) {
  		db.users.findOne({pocket_name: req.session.passport.user}, function(err, doc){
  			if (err) {return console.error('oh no, error! \n' + err)}
  			renderPage(doc)
  		});
    } else {
      renderPage()
    }
    function renderPage(user){
      res.render('listdetails', {
        appname: settings.APP_NAME,
        title: settings.APP_NAME + ' - ' + name,
        listid: req.params.listId,
        ownerid: req.params.userId,
        owner: owner,
        name: name,
        feeds:feeds,
        user: user,
        firstfeed: firstFeed
      })
    }
  };

// kick things off
getOwner(req.params.userId, req.params.listId);
});

// POST for adding feeds
router.post('/:userId/:listId/addfeed', ensureLoggedIn('/'), function(req, res){
  var userId = req.params.userId;
  var list = req.params.listId;
  pocketfeeds.checkUrl(req.body.url, function(err, data) {
    if (err) {
      console.error(err)
      // send to error page
      res.redirect(`/lists/${userId}/${list}/error/${err}`);
    }
    else {
      var url = req.body.url,
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
            res.redirect(`/lists/${userId}/${list}`);
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
    if (err) {
      console.error(err)
      // send to error page
      return res.redirect(`/lists/${user}/${list}/error/${err}`);
    } else {
      // update the DB
      db.feeds.update({feed:feed}, {$set: {feed: feed, url: data.url, title: data.title}}, {upsert: true}, function(err, num, doc){
        if (err) {
          return res.redirect(`/lists/${user}/${list}/error/${err}`);
        } else {
          db.feeds.update({feed:feed}, {$addToSet: {lists: list}}, {upsert: true}, function(err, num, doc){
            if (err) {
              return res.redirect(`/lists/${user}/${list}/error/${err}`)
            }
            return res.redirect(`/lists/${user}/${list}`);
          });
        }
      });
    }
  })
});

module.exports = router;
