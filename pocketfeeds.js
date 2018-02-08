const cheerio = require('cheerio');
var request = require('request');
var stringify = require('fast-json-stable-stringify'); //not sure if this is really required?
var app = require('./app');
var FeedParser = require('feedparser');
var db = require('./nedb.js');
var settings = require('./settings');

// export
var pocketfeeds = module.exports = {};

//*********************************
//
// CHECKING FEEDS ARE VALID
//
//*********************************

// take a site URL and get the title and RSS URL
pocketfeeds.checkUrl = function(link, callback) {
	request.get(link, function (error, response, body) {
		try {
			// if (!error && response.statusCode == 200) {
			  const site = body;
			  const $ = cheerio.load(site)
				// get the head <title> element
			  const titleElem = $('title').clone();
				// get the RSS or Atom feed element
			  const rss = $('link[type="application/rss+xml"]').clone();
				const atom = $('link[type="application/atom+xml"]').clone();
				// If rss exists assign its value to elem, otherwise assign the value of atom
				const elem = rss ? rss : atom;
				var err = null;
				var feed = null;
				var title = null;
				// elem may be null or not have any child nodes if there is no feed at all so we need to call an error
				if (!elem[0] || !elem) {
					return callback('NOFEED', null)
				} else {
					// some subpages (e.g. abc.net.au/news) use relative URLs, which are a PITA.
					// Ini this case we reconstruct the feed from the canonical root URL rather than make users do it.
					if (elem[0].attribs.href.substring(0,4) != 'http') {
						feed = response.req._headers.protocol + '//' + response.req._headers.host + elem[0].attribs.href;
						// it's theoretically possible they forgot to set a title on the page
						if (titleElem[0].children[0].data) {
							title = titleElem[0].children[0].data;
						} else {
							// if they did forget, we'll use the URL
							title = link;
						}
				  } else {
						feed = elem[0].attribs.href;
						if (titleElem[0].children[0].data) {
							title = titleElem[0].children[0].data;
						} else {
							title = link;
						}
				  }
				}
			return callback(err, {feed: feed, title: title});
		} catch (error) {
			return callback(error, null)
		}
	});
}

//*********************************
//
// CHECKING AND SENDING ARTICLES
//
//*********************************

// send article to subscribers (Set)
pocketfeeds.sendArticle = function(link, token, callback) {
		request.post({url: `https://getpocket.com/v3/add?consumer_key=${settings.POCKET_CONSUMER_KEY}&access_token=${token}&url=${link}&tags=empocketer`}, function (err, res, body){
			callback(err, res, body)
			if (err) {
				callback(err, null)
			} else {
				callback(null, true)
			}
		});
}

// get subscribers from lists (Object)
pocketfeeds.getSubscribers = function(link, listIds, callback) {
	// for each list get subscribers array
	listIds.forEach( function(id){
		db.lists.findOne({_id: id}, function(err, doc){
			// subscribers is an array
			var subscribers = doc.subscribers;
			subscribers.forEach(function(subscriber) {
				// send the article to the subscriber
				pocketfeeds.sendArticle(link, subscriber, callback);
			});
		});
	});
}

// get lists subscribing to this feed
pocketfeeds.getListIds = function(link, feedId, callback) {
	var feed = db.feeds.findOne({_id: feedId}, function(err, doc){
		var listIds = [];
		function addId(id){
			listIds.push(id)
		}
		// each feed might have multiple lists. doc is an array, so we need to iterate over it then push to listIds from outside the loop.
		for (i = 0; i < doc.lists.length; i++) {
			addId(doc.lists[i])
		}
		pocketfeeds.getSubscribers(link, listIds, callback);
	})
}

// set new start timer

pocketfeeds.setNewTime = function(id, time) {
	var now = Date.now();
	var nowDate = new Date(now);
	var startReadable = nowDate.toUTCString();
	if (time) {
	 var previousReadable =  new Date(time).toUTCString();
 } else {
	 var previousReadable = 'no previous run';
	 time = 'no previous run';
 }

	db.timer.update({startTime: {$exists: true}}, {$set: {startTime: now, startReadable: startReadable, previousRun: time, previousReadable: previousReadable}}, {upsert: true}, function(err, doc) {
		if (err) {
			console.error(error)
		}
	})
}

// check for new articles when the timer goes off
pocketfeeds.getFreshArticles = function() {
	// retrieve the last runtime from the database, or if there isn't one, use four hours
	var lastRun = db.timer.findOne({}, function(err, doc){
		if (err) {
			return console.error(`ERROR with database: \n ${err}`)
		} else if (doc === null) {
			pocketfeeds.setNewTime(null);
			return 14400000;
		} else {
			pocketfeeds.setNewTime(doc._id, doc.startTime);
			return doc.startTime;
		}
	});

	db.feeds.find({}, function(err, docs){
		docs.forEach(function(doc){
			var feed = doc;
			var req = request(feed.feed)
			var feedparser = new FeedParser();
			req.on('error', function (error) {
			  // handle any request errors
				// probably should do something more sophisticated
				console.error(`error requesting ${feed}`)
			});

			req.on('response', function (res) {
			  var stream = this; // `this` is `req`, which is a stream
			  if (res.statusCode !== 200) {
			    this.emit('error', new Error('Bad status code'));
			  }
			  else {
			    stream.pipe(feedparser);
			  }
			});
			feedparser.on('error', function (error) {
				//TODO this isn't really "handling"! BUT it doesn't actually stop the app running
				console.error(`error piping stream from ${feed.feed} - ${error}`);
			});
			feedparser.on('readable', function () {
			  var stream = this;
			  var meta = this.meta;
			  var item;
			  while (item = stream.read()) {
					// only check items since the last time the bot ran.
					if (item.date > (Date.now() - lastRun)){
						var link = item.link;
						var feedId = feed._id;
						// then for each new article...
						pocketfeeds.getListIds(link, feedId, function(error, result){
							if (error) {
								console.error(`error with ${link} = ${error}`)
							} else {
								console.log('sent ${link} with no errors: ' + result)
							}
						});
					}
			  }
			});
			feedparser.on('end', ()=> {
				// done
			});
		});
	});
}

setInterval(pocketfeeds.getFreshArticles, 7200000);
// for testing
// setInterval(pocketfeeds.getFreshArticles, 6000);