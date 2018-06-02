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
		margin: '5px 5px 1em',
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

class Messages extends Component {
	constructor(props) {
		super(props);

		this.state = {
			messages: [],
			lists: [],
			subscriptions: []
		}
		// don't forget to bind this for all your functions.
		this.dismiss = this.dismiss.bind(this);
		this.flipCard = this.flipCard.bind(this);
		this.updateList = this.updateList.bind(this);
		this.editList = this.editList.bind(this);
		this.handleInputChange = this.handleInputChange.bind(this);
		this.displayAddFeedForm = this.displayAddFeedForm.bind(this);
		this.cancelAddingFeed = this.cancelAddingFeed.bind(this);
		this.addFeed = this.addFeed.bind(this);
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

	flipCard({target}) {
		return target.parentNode.parentNode.parentNode.classList.toggle('flipped')
	}
// list, name, description, tags, public
	updateList(list, e) {
		e.preventDefault();
		// replace the list with a JSON object of just the values we want to update on the DB
		const query = {_id: list._id, name: list.name, description: list.description, tags: list.tags, public: list.public}
		// use fetch to do a AJAX POST request
		fetch(`/api/v1/edit-list`,
			{
				method: 'POST',
				credentials: 'include',
				headers: {'Content-Type': 'application/json'},
	  		body: JSON.stringify(query)
			}
		)
		.then( res => res.json()) // get the response then update State
		.then(doc => {
			const lists = this.state.lists.map(list =>
				(list._id !== doc._id) ?
				  list :
					{
						...list,
						name: doc.name,
						description: doc.description,
						tags: doc.tags,
						public: doc.public,
						editing: false
					}
				)
				this.setState({lists})
			}
		)
	}

	// flip state to editing to show the editing form
	editList(id, e) {
		const lists = this.state.lists.map(list =>
			(list._id !== id) ?
				list :
				{
					...list,
					editing: true
				}
			)
			this.setState({lists})
	}

	// basically copied from https://reactjs.org/docs/forms.html
	// this updates state on every keystroke
	handleInputChange(id, {target}) {
		const value = target.type === 'checkbox' ? target.checked : target.name === 'tags' ? Array.from(target.value.split(',')) : target.value;
		const name = target.name;
		const lists = this.state.lists.map(list =>
			(list._id !== id) ?
				list :
				{
					...list,
					[name]: value
				}
			)
			this.setState({lists})
	}

	// when the user clicks 'add feed' we change the state so we can display the add feed form
	// when they hit submit on the form we send the changes to the DB and update state again to make addingFeeds false.
	displayAddFeedForm(id, e) {
		const lists = this.state.lists.map(list =>
			(list._id !== id) ?
				list :
				{
					...list,
					addingFeeds: true
				}
			)
			this.setState({lists})
	}

	cancelAddingFeed(id, e) {
		const lists = this.state.lists.map(list =>
			(list._id !== id) ?
				list :
				{
					...list,
					addingFeeds: false
				}
			)
			this.setState({lists})
	}

	addFeed(id, e) {
		e.preventDefault();
		fetch(`/api/v1/add-site`,
			{
				method: 'POST',
				credentials: 'include',
				headers: {'Content-Type': 'application/json'},
	  		body: JSON.stringify({url: e.target.site.value, name: e.target.name.value, list: id})
			}
		)
	}

	// Each time the #messages component mounts 	we do an AJAX call to check for any user messages on the server, using whatwg-fetch.
	componentDidMount() {
		fetch('/dashboard/messages', {credentials: 'include'})
		.then(res => res.json())
		.then(json => {
				const messages = json;
				this.setState({messages})
			})
		.catch(err => console.error(err))

		fetch('/dashboard/user-lists', {credentials: 'include'})
		.then(res => res.json())
		.then(json => {
			const lists = json.lists;
			const subscriptions = json.subscriptions;
			this.setState({lists, subscriptions})
		})
		.catch(err => console.error(err))
	}

	render() {
		const {dismiss, flipCard, updateList, editList, handleInputChange, displayAddFeedForm, cancelAddingFeed, addFeed} = this;
		const {messages, lists, subscriptions} = this.state;
		return (
			<div>
				<ol style={styles.messages} className='userMessages'>
				  {this.state.messages.length > 0
						? <ShowMessages
						  messages={messages}
							dismiss={dismiss}/>
						: ''}
				</ol>
				<div>
					<h1>My Lists</h1>
					<ShowLists
					  lists={lists}
						flipCard={flipCard}
						updateList={updateList}
						editList={editList}
						handleInputChange={handleInputChange}
						displayAddFeedForm={displayAddFeedForm}
						cancelAddingFeed={cancelAddingFeed}
						addFeed={addFeed}/>
					<AddLists />
				</div>
				<div>
					<h1>My Subscriptions</h1>
					<ShowSubscriptions
					  subscriptions={subscriptions}
						flipCard={flipCard} sub={true}/>
				</div>
			</div>
		)
	}
}

const ShowList = ({list=[], sub, flipCard, updateList, editList, handleInputChange, displayAddFeedForm, cancelAddingFeed, addFeed}) =>
	<div className='listcard'>
		<div className='flip'>
		{ /* here we need to put the logic to deal with editing. should break both options into components */
		list.editing ?
		<EditingListView
			list={list}
			updateList={updateList}
			handleInputChange={handleInputChange}
		/>
		:
		<StandardListView
			list={list}
			sub={sub}
			flipCard={flipCard}
			updateList={updateList}
			editList={editList}
		/>
		}
			{/*
				here we are checking whether the user is wanting to add a feed (i.e. has clicked 'add feed')
			*/}
			{list.addingFeeds
				? <div className='list adding back'>
				    <form className="addFeedContainer" type='url' name='addFeed' onSubmit={(e) => addFeed(list._id, e)}>
							What would you like to call this feed?
							<input name='name' className='addFeedName' type='text' placeholder='Awesome Feed'/>
							What's the URL of the site you'd like to add?
						  <input required name='site' className='addFeedName' type='url' placeholder='https://site.com'/>
							<input type='submit' className='submit' value='Add it!'/>
							<button className='cancel' onClick={(e) => cancelAddingFeed(list._id, e)}>cancel</button>
						</form>
					</div>
				:
				/*
				  if not adding feeds, show the normal back of the card
				*/
			<div
			  className={sub
				? 'list subscription back'
				: (list.public === 'true')
				  ? 'list public back'
					: 'list private back'}>
				<div>
				<button
				  onClick={flipCard}
				  className='flipToFront'>i</button>
				<button
					onClick={(e) => displayAddFeedForm(list._id, e)}
				  className='addFeed'>Add</button>
				</div>
			  <ul>
				  <Feeds
					  feeds={list.feeds}/>
				</ul>
			</div>}
		</div>
	</div>

const EditingListView = ({list, updateList, handleInputChange}) =>
<div className={list.public ? 'list public front' : 'list private front'}>
 <form onSubmit={ (e) => updateList(list, e)}>
 	<input name='name' type='text' defaultValue={list.name} onChange={ (e) => handleInputChange(list._id, e)}/>
	<input name='description' type='text' defaultValue={list.description} onChange={(e) => handleInputChange(list._id, e)} />
	<input name='tags' type='text' defaultValue={list.tags} onChange={(e) => handleInputChange(list._id, e)} />
	<input name='public' type='checkbox' checked={list.public ? 'checked' : ''} onChange={(e) => handleInputChange(list._id, e)} />
	<input name='listupdate' type='submit' value='update'/>
 </form>
 </div>

const StandardListView = ({list, sub, flipCard, updateList, editList}) =>
<div
	id={`id${list._id}`}
	className={sub ? 'list subscription front' : list.public ? 'list public front' : 'list private front'}>
	<h2 className='listName'>{list.name}</h2>
	<div className='listDescription'>{list.description}</div>
	{list.tags ? <Tags tags={list.tags}/>: ''}
	<Buttons
		list={list}
		sub={sub}
		flipCard={flipCard}
		updateList={updateList}
		editList={editList}/>
</div>

const Tags = ({tags}) =>
	<div>
		{tags}
	</div>

const Feeds = ({feeds}) =>
  feeds.map(feed =>
	  <li
		  className='feedListing'
		  key={feed._id}
			>
	    {feed.title}
			<button> {/* these buttons should not be here for subscriptions */}
				edit
			</button>
			<button>
				🗑
			</button>
		</li>)

const Buttons = ({list, sub, flipCard, updateList, editList}) =>
	<div>
		<button
		  onClick={flipCard}
		>
			{list.feeds.length} feeds
		</button>
		<button>
			{list.subscribers.length - 1} subscribers
		</button>
		{sub
			?
			<button className='clone'> Clone </button>
			:
			<button className={'edit-list'} onClick={ (e) => editList(list._id, e)}>Edit</button>
		}
			<button>
				🗑
			</button>
	</div>

const ShowMessages = ({messages, dismiss}) =>
		messages.map( (msg) =>
			<li key={msg.id}>
				<div
				  id={msg.id}
					onClick={dismiss}
					style={styles.close}>x</div>
				<div>{msg.text}</div>
				<div
				  style={styles.suggest}>
				{msg.code === "NOSITE"
				  ? 'Could not find the root URL: try adding the site using the Add New Feed button.'
					: 'Could not find the feed: Try adding the feed manually.'}
				</div>
				<div style={styles.time}>{moment(msg.time).fromNow()}</div>
			</li>
		)

const ShowLists = ({lists=[], flipCard, updateList, editList, handleInputChange, displayAddFeedForm, cancelAddingFeed, addFeed}) =>
	lists.map(list =>
		<ShowList
			list={list}
			key={list._id}
			flipCard={flipCard}
			updateList={updateList}
			editList={editList}
			handleInputChange={handleInputChange}
			displayAddFeedForm={displayAddFeedForm}
			addFeed={addFeed}
			cancelAddingFeed={cancelAddingFeed}
			/>)

const ShowSubscriptions = ({subscriptions=[], sub=true, flipCard}) =>
	subscriptions.map(list =>
		<ShowList
			list={list}
			sub={sub}
			flipCard={flipCard}
			key={list._id}
			/>)

const AddLists = () =>
	<div className='listcard'>
		<div className='list new'>
			<button>Create new list</button>
			<button>Import from OPML</button>
		</div>
	</div>

const target = document.querySelector('#messages')
ReactDOM.render(<Messages/>, target)