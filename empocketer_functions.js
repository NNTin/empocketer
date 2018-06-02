'use strict'
// TODO - may not need all these.
const cheerio = require('cheerio');
// const request = require('request'); // should use fetch instead
const stringify = require('fast-json-stable-stringify');
const app = require('./app');
const FeedParser = require('feedparser');
const db = require('./nedb.js');
const settings = require('./settings');
const opmltojs  = require('opmltojs');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const uuid = require('uuid');
require('es6-promise').polyfill();
require('isomorphic-fetch'); // use this because whatwgt-fetch doesn't work in node
// export
const ef = module.exports = {};

ef.getFeedInfoFromURL = function(url) {
	return new Promise( (resolve, reject) => {
		fetch(url)
		.then(function(response) {
			return response.text()
		})
		.then(ef.parseFeedFromSite)
		.catch( (e) => reject(e) )
		.then( (args) => {
			// extract the base domain URL using a regex
			var baseURL = /(.+(\/+){2})+(\w|\d|\.|-)*/.exec(url)[0];
			// if the feed address is relative we need to add it to the base domain URL
			var feed = /^http/.test(args.feed) ? args.feed : `${baseURL}${args.feed}`;
			args.feed = feed; // update feed address
			args.url = url; // add original url to args object
			resolve(args)
		})
	})
}

ef.getFeedInfoFromRSS = function() {

}

ef.parseFeedFromSite = function(body) {
	return new Promise( (resolve, reject) => {
		try {
		const $ = cheerio.load(body)
		// get the head <title> element
		const titleElem = $('title').clone();
		// get the RSS or Atom feed element
		const rss = $('link[type="application/rss+xml"]').clone();
		const atom = $('link[type="application/atom+xml"]').clone();
		// If rss exists assign its value to elem, otherwise assign the value of atom
		const elem = rss ? rss : atom;
		// elem may be null or not have any child nodes if there is no feed at all so we need to call an error
		if (!elem[0] || !elem) {
			resolve({error: "NOFEED"})
			// TODO sometimes there *is* a feed but it's not listed in the headers. Is there another way to try to find it before giving up?
		} else {
			// get the feed and title from the rss link element
			let feed = elem[0].attribs.href;
			// if the link element doesn't have a title, grab the title from the page itself
			let title = elem[0].attribs.title ? elem[0].attribs.title : titleElem[0].children[0].data;
			resolve({feed: feed, title: title})
		}
	} catch (err) {
		resolve({error: err})
	}
	})
}

ef.upsertNewFeed = function(args) {
	return new Promise( (resolve, reject) => {
		db.feeds.update({feed: args.feed}, {$set:{feed: args.feed, url: args.url, title: args.title}}, {upsert: true}, function(err, num, doc, upsert){
			if (err) {
				reject(err)
			} else {
				console.log(num)
				if (doc == undefined){
					// it was already in the DB, but maybe not in this list
					// TODO check if the feed is already in this list, and throw an error.
					// at the moment it simply reloads the page but there is no UI indication why basically nothing happened.
					console.log('already in the db')
					resolve(args)
				} else {
					console.log(`added feed: ${doc._id}`)
					resolve(args)
				}
			}
		})
	})
}

ef.addListToFeed = function(args) {
	return new Promise( (resolve, reject) => {
		db.feeds.update({feed: args.feed}, {$addToSet: {lists: args.list}}, {upsert: true}, function(err, num, doc){
			if (err) {
				reject(err)
			}
			console.log(num)
			console.log(`added ${args.list} to ${args.feed}`)
			resolve()
		});
	})
}