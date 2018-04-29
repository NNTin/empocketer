A web app built with nodejs and express.

# What does empocketer do?

_Empocketer_ allows anyone with a [Pocket](https://getpocket.com) account to log in to the app, and create lists of sites with RSS or Atom feeds. Every two hours it checks all those feeds for new content, and pushes new articles to the Pocket accounts of the relevant users.

# How does it work?

Empocketer uses [Passport](http://www.passportjs.org) and the `passport-pocket` package to handle logins, using Pocket's API based on OAuth. Routing uses [Express](https://expressjs.com/), and the [Handlebars](http://handlebarsjs.com/) template engine. The database is embedded in the app using [nedb-core](https://github.com/nedbhq/nedb-core) and feeds are checked using the ever-reliable [feedparser](https://www.npmjs.com/package/feedparser) package.

Now includes a user message system using React. There will probably be more React components to come.

# Requirements

You will need to [register your app with Pocket](https://getpocket.com/developer/) and get a Pocket Consumer Key. You also need an smtp email host. I recommend [Mailgun](https://www.mailgun.com/) - it's free unless you're sending more than 10,000 emails per month, which seems rather reasonable!

# installing your own version

1. save the code to the directory you will be serving it from
2. copy settings-example.json to a new file called settings.json, and fill it in with your own real values.
3. `npm install`
4. `npm start`
5. point your web browser to `localhost:3000`

If you want to run it on a server (i.e. not to just test on your own machine) you'll need to set up something like `forever` or `systemd` to keep it running. It will default to run on port 3000 so you'll need to [configure a proxy](https://www.sitepoint.com/configuring-nginx-ssl-node-js/)

# Todos
* Admin interface, including ability to block users, blacklist certain terms from being used in list names, and possibly ban certain feeds.
* Account deletion
* more complete installation instructions including hosting config

See Issues for any other stuff that's being worked on.

# License

GPL 3+