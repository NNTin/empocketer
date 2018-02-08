//DB
var Datastore = require('nedb-core')
var db = {};
db.users = new Datastore({ filename: './data/users', autoload: true });
db.feeds = new Datastore({ filename: './data/feeds', autoload: true });
db.lists = new Datastore({ filename: './data/lists', autoload: true });
db.timer = new Datastore({ filename: './data/timer', autoload: true });
module.exports = db;
