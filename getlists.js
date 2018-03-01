var app = require('./app');
var db = require('./nedb.js');

// export
var getlists = module.exports = {};

getlists.byname = function(options) {
	console.log('options HERE are ' + options)
	// wrap the DB call up in a promise
  function getLists() {
		console.log(`options are ${options}`)
    return new Promise((resolve, reject) => {
      //TODO once finished testing, restrict this to public: true
      db.lists.find(options).sort({name: 1, subscribers: -1}).exec(function(err, docs) {
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
	return attachOwners()
}