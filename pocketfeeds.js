'use strict'

const cheerio = require('cheerio');
var request = require('request');
var stringify = require('fast-json-stable-stringify'); //not sure if this is really required?
var app = require('./app');
var FeedParser = require('feedparser');
var db = require('./nedb.js');
var settings = require('./settings');
var opmltojs  = require('opmltojs');
var multer = require('multer');
var upload = multer({ dest: 'uploads/' });

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
					// return callback('NOFEED', null)
					throw "NOFEED"
					// TODO sometimes there *is* a feed but it's not listed in the headers. Is there another way to try to find it before giving up?
				} else {
					// some subpages (e.g. abc.net.au/news) use relative URLs, which are a PITA.
					// In this case we reconstruct the feed from the canonical root URL rather than make users do it.
					if (elem[0].attribs.href.substring(0,4) != 'http') {
						// check whether the feed uses http or https
						// TODO we use the 'private' field _headers here (instead of headers) but tbh I'm not sure why. This may no longer be necessary, need to check recent node and Express docs.
						if (response.req._headers.protocol) {
								feed = response.req._headers.protocol + '//' + response.req._headers.host + elem[0].attribs.href;
						} else {
							// if protocol is not in the headers, use http and hope it gets upgraded if necessary
							feed = 'http://' + response.req._headers.host + elem[0].attribs.href;
						}
						// it's theoretically possible they forgot to set a title on the page
						if (titleElem[0].children[0].data) {
							title = titleElem[0].children[0].data;
						} else {
							// if they did forget, we'll use the URL
							title = link;
						}
				  } else {
						// the first bit of the string is http so we're all good
						feed = elem[0].attribs.href;
						// check the title here too
						// TODO we can probably move this down and keep the code DRY
						if (titleElem[0].children[0].data) {
							title = titleElem[0].children[0].data;
						} else {
							title = link;
						}
				  }
					// TODO put the code for checking the title here
				}
			return callback(err, {feed: feed, title: title});
		} catch (error) {
			// this error will be thrown if the URL doesn't exist
			if (error.message === "Cannot read property 'parent' of undefined") {
				return callback('NOSITE', null);
			} else {
				return callback(error, null)
			}
		}
	});
}

// GET TITLE AND URL WHEN YOU ALREADY HAVE THE FEED
pocketfeeds.checkFeed = function(feed, callback) {
	// use feedparser to get meta.title and meta.link
	const req = request(feed);
	const feedparser = new FeedParser();
	try {
		var callVals= {};

		function awaitVals() {
			return new Promise((resolve, reject) => {
				req.on('error', function (error) {
					resolve({error: 'NOFEED', data: null});
				});

				req.on('response', function (res) {
					var stream = this; // `this` is `req`, which is a stream

					if (res.statusCode !== 200) {
						resolve({error: 'NOSITE', data: null});
					}
					else {
						stream.pipe(feedparser);
					}
				});

				feedparser.on('error', function (error) {
					resolve({error: error, data: null});
				});

				feedparser.on('readable', function () {
					var stream = this;
					var meta = this.meta;
						// get meta and add feed to DB
						// warning: we can still get to here if the url provided is not a feed but *is* a readable URL
						if (meta.link) {
							resolve({error: null, data: {title: meta.title, url: meta.link, feed: feed}});
						} else {
							resolve({error: 'NOFEED', data: null});
						}
				});
			})
		}
		awaitVals().then((vals) => callback(vals.error, vals.data));
	} catch (err) {
		console.log(`caught error and returning error in callback:\n${err}`)
		callback(err, null);
	}
}

// PROCESS OPML FILE
pocketfeeds.processOpml = function(req, data, finishCallback) {

	// this takes the new array of objects from buildLists and inserts a new list for each heading
	function buildNewLists(data) {
		db.users.findOne({pocket_name: req.session.passport.user}, function(err, user) {
			// map the array so we can return a promise for each object
			const promises = data.map(function(x){
				if (x) {
					return theNewFunc(x)
				}
			});
			// upsert the list
			function theNewFunc(x) {
					return new Promise((resolve, reject)=>{
						const newList = {name: x.list, owner: user._id, public: false, subscribers: [user.pocket_token]}
						db.lists.insert(newList, function(err, list) {
							// in callback from update, run through each feed
							if (err) {
								console.log(`error with ${x.list} - err`)
								reject(err);
							} else {
								resolve({feeds: x.feeds, listId: list._id})
							}
						})
					})
			}
			// when all the lists are done, the promises resolve and we send the new objects with the list IDs on to extractFeeds and the addFeedsToListInOpml
			Promise.all(promises).then(extractFeeds).then(addFeedsToListInOpml)
		})
	}

	// map each list object so that the whole thing becomes an array of objects
	function extractFeeds(group) {
		return new Promise((resolve, reject)=> {

			const newArray = [];

			group.map(function(x){
				if (x) return flip(x)
			})

			// take the feed info and pair it with it's list ID
			function flip(list) {
						for (let feed of list.feeds) {
							if (feed){
							newArray.push({feed: feed, list: list.listId})
						} else {
						console.error(`something went wrong: no list!`)
					}
				}
			}
				// resolve the new array and send on.
				resolve(newArray)
		})
	}


	function addFeedsToListInOpml(lists) {
		// map to an array of promises so we can deal with everything and use Promise.all()
		const promises = lists.map(function(x){
				return theFeedsFunc(x)
		});

		function theFeedsFunc(feed) {
			return new Promise((resolve, reject)=> {
				if (feed) {
					pocketfeeds.checkFeed(feed.feed, function(err, result) { //result here is undefined
						if (err) {
							// TODO really should do something a bit better here, and throw it to the screen somehow.
							console.error(`error with ${feed.feed} - ${JSON.stringify(err, undefined, 4)}`)
							// we still resolve this, otherwise Promise.all() won't run
							resolve()
						} else {
							resolve({feed: result, listId: feed.list});
						}
					})
				} else {
					console.error(`error: no feed!`)
					resolve()
				}
			})
		}
		// wait for al promises to resolve and then pass on the array
		Promise.all(promises).then(upsertFeeds)
	};

	function upsertFeeds(info) {
		const promises = info.map(function(x){
			if (x) return upsertFeedsEachList(x)
		});

		function upsertFeedsEachList(info) {
			// upsert feed into database
			return new Promise((resolve, reject) => {
				db.feeds.update({feed: info.feed.feed}, {$set:{feed: info.feed.feed, url: info.feed.url, title: info.feed.title}}, {upsert: true}, function(err, num, doc, upsert){
					if (err) {
						// TODO do something better with this
						console.log(`error updating ${info.feed.feed} - ${err}`)
						resolve()
					}
					resolve(info);
				})
			})
		}
		// await all the promises and then send on.
		Promise.all(promises).then(finishList)
	}

	function finishList(info) {
		const promises = info.map(function(x){
			if (x) return updateFeedsWithLists(x)
		});

		function updateFeedsWithLists(info){
			return new Promise((resolve, reject) => {
				// update list information for feed
				db.feeds.update({feed: info.feed.feed}, {$push: {lists: info.listId}}, {multi: true}, function(err, num, doc){
					// DONE for this feed
					if (err) {
						console.error(`error with ${info.feed.feed} - ${err}`)
					}
					resolve()
				})
			})
		}
		Promise.all(promises)
		.catch((e) => console.error(`error \n${e}`)) // report all remaining errors
		.then(function(){
			return finishCallback('Done!') //returns back to lists.js
		})
	}

	// first we take the raw opml file and parse it out using opmltojs
	function buildLists(data){
		return new Promise ((resolve, reject) => {
			try {
		    opmltojs.parse(data, function (file) {
		      const newFeeds = new Object();
		      function myFunc(file, callback) {
		      	// we call an inner function here to distinguish between the original call (with a callback) and the subsequent 'inner' calls.
		      	function getFeeds(file, sendback) {
		      		// get the keys from wherever we're at in the file
		      		const keys = Object.keys(file);
		      		try {
		      			for (let key of keys) {
		      				// if there are subs, try looking for a feed URL
		      				if (file[key].subs) {
		      					for (let sub of file[key].subs) {
		      						if (sub.subs){
		      							for (let feed of sub.subs) {
		      								//if this is a feed entry, push the feed URL
		      								if (feed.xmlUrl) {
		      									if (!newFeeds[sub.text]) {
		      										newFeeds[sub.text] = [];
		      									}
		      									newFeeds[sub.text].push(feed.xmlUrl)
		      								} else {
		      									// if there is no feed.xmlUrl then we need to go down another level
		      									getFeeds(feed)
		      								}
		      							}
		      						} else {
		      							// something is probably malformed in this opml file
		      							console.log('ERROR finding feeds')
		      						}
		      					}
		      				// if there is a body element, that's a good place to look for subs!
		      				} else if (file[key].body) {
		      						getFeeds(file[key], null)
		      				}	else {
		      					// if we get to here then this file only has one heading so look for feeds here
		      					if (key === 'subs' && file[key].length > 0) {
		      						for (let feed of file[key]) {
		      							if (!newFeeds[file.text]) {
		      								newFeeds[file.text] = [];
		      							}
		      							newFeeds[file.text].push(feed.xmlUrl)
		      						}
		      					} else {
		      						// if we get to here, it's an element we don't need to worry about e.g. head
		      					}
		      				}
		      			}
		      		} catch (e) {
		      			if (sendback) {
		      				return sendback(e, null)
		      			} else {
		      				console.trace();
		      				throw `error!\n ${e}`;
		      			}
		      		}
		      		// only send the callback if there is one (i.e. from the initial call, below, not the failsafe ones in the flow above)
		      		if (sendback) {
								// var newMap = new Map(newFeeds);
								// console.log(`newMap is ${newMap}`)
		      			sendback(null, newFeeds)
		      		}
		      	}
		      	// kick things off
		      	getFeeds(file, callback);
		      }
		      // we start here and call the function(s) above
		  		try {
		  			myFunc(file, function(err, newFeeds){
		  				if (err) throw err;
							const newArray = [];
							Object.keys(newFeeds).forEach(list => {
								newArray.push({list: list, feeds: newFeeds[list]});
							})

						buildNewLists(newArray)
						// finishCallback()
		  		});
		  		} catch (err) {
		  			reject(err)
		  		}
		  	})
		  } catch (err) {
		    reject(err)
		  }
		})
	}
buildLists(data)
}

//*********************************
//
// SENDING ARTICLES
//
//*********************************

// send article to subscribers (Set)
pocketfeeds.sendArticle = function(link, token, callback) {
	request.post({url: `https://getpocket.com/v3/add?consumer_key=${settings.POCKET_CONSUMER_KEY}&access_token=${token}&url=${link}&tags=empocketer`}, function (err, res, body){
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
// console.log(listIds)
	listIds.forEach(function(id){
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
	// find the lists for this feed
	var feed = db.feeds.findOne({_id: feedId}, function(err, doc) {
		// check the lists array isn't empty (it shouldn't be, because we should have deleted the feed listing)
		if (doc.lists.length > 0) {
		var listIds = [];
		// each feed might have multiple lists. doc is an array, so we need to iterate over it then push to listIds.
		function pushIds(callback) {
			for (let i = 0; i < doc.lists.length; i++) {
				listIds.push(doc.lists[i])
			}
			return callback(null, listIds)
		}
	// get Subscribers using the listIds array
	// we use another callback here so that the for loop completes before we grab the listIds array
			pushIds(function(err, listIds){
				if (err) {console.log('there was an error')};
				// 'callback' here is the one from the outside function, not the callback we're in, obviously
				pocketfeeds.getSubscribers(link, listIds, callback);
			})
		}
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

	function startFeedParser(lastRun){
		db.feeds.find({}, function(err, docs){
			docs.forEach(function(doc){
				var feed = doc;
				var req = request(feed.feed)
				var feedparser = new FeedParser();
				req.on('error', function (error) {
				  // handle any request errors
					// probably should do something more sophisticated
					console.error(`error requesting ${feed.feed} \n error`)
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
						// only check items published since the last time the bot ran.
						// we use pubdate (original publication time) instead of date (last update time) because YouTube appears to show the last updated time as more or less the current time.
						if (item.pubdate > lastRun){
							var link = item.link;
							var feedId = feed._id;
							// then for each new article...
							pocketfeeds.getListIds(link, feedId, function(error, result){
								if (error) {
									console.error(`error with ${link} \n ${error}`)
								} else {
									console.log(`sent ${link} with no errors: ${result}`)
								}
							});
						}
				  }
				});
				feedparser.on('end', ()=> {
					// done with this feed
				});
			});
			// done with everything
			console.log(`finished loop`)
		});
	}; // end of startFeedParser

	// this is actually where we start, then everything moves upwards
	// retrieve the last runtime from the database, or if there isn't one, use four hours
	db.timer.findOne({}, function(err, doc){
		if (err) {
			return console.error(`ERROR with database: \n ${err}`)
		} else if (doc === null) {
			pocketfeeds.setNewTime(null);
			startFeedParser(14400000);
		} else {
			pocketfeeds.setNewTime(doc._id, doc.startTime);
			startFeedParser(doc.startTime);
		}
	});
} // end of getFreshArticles

setInterval(pocketfeeds.getFreshArticles, 7200000);
// for testing
// setInterval(pocketfeeds.getFreshArticles, 120000);