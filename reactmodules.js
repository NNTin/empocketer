import React, { Component } from 'react' // react on the server
import ReactDOM from 'react-dom' // react in the browser
import 'whatwg-fetch' // fetch
const moment = require('moment');
moment().format();

// NOTE inject css here for the time being, though I'd prefer to use a proper stylesheet for consistency with the rest of the app

const styles = {
	messages:{
		padding: 0,
	},
	close:{
		margin: '5px',
		lineHeight: '1px',
		textAlign: 'right',
		cursor: 'pointer'
	},
	suggest:{
		marginTop: '0.5em',
		fontStyle: 'italic'
	},
	time: {
		textAlign: 'right',
		fontStyle: 'italic',
		color: 'lightgray',
		fontSize: '0.8em'
	}
}

const link = '/dashboard/messages';
const fetchSettings = {credentials: 'include'};

class Messages extends Component {
	constructor(props) {
		super(props);

		this.state = {
			messages: []
		}
		// don't forget to bind this for all your functions.
		this.dismiss = this.dismiss.bind(this);
	}

	// when a message is dismissed we do an AJAX call to remove it from the database and then update the state.
	dismiss({target}) {
		fetch(`/dashboard/dismiss-message/${target.id}`, {credentials: 'include'})
		.then(res => res.json())
		.then(json => {
				const messages = json;
				this.setState({messages})
			}
		)
	}

	// Each time the messages component mounts (changes) we do an AJAX call to check for any user messages on the server, using whatwg-fetch.
	componentDidMount() {
		fetch(link, fetchSettings)
		.then(res => res.json())
		.then(json => {
				const messages = json;
				this.setState({messages})
			}
		)
	}

	render() {
		const {dismiss} = this;
		const {messages} = this.state;
		return (
			this.state.messages.length > 0 ?
			<div>
				<ol style={styles.messages}>
				{this.state.messages.map( msg =>
					<li key={msg.id}>
						<div id={msg.id} onClick={dismiss} style={styles.close}>x</div>
						<div>
					  {msg.text}
						</div>
						<div style={styles.suggest}>
						{msg.code === "NOSITE" ? 'Could not find the root URL: try adding the site using the Add New Feed button.' : 'Could not find the feed: Try adding the feed manually.'}
						</div>
						<div style={styles.time}>
						{moment(msg.time).fromNow()}
						</div>
					</li>
				)}
				</ol>
			</div>
			: <div style={styles.suggest}>
				No messages
				</div>
		)
	}
}

const target = document.querySelector('#messages')
ReactDOM.render(<Messages/>, target)