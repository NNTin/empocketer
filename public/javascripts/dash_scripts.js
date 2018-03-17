// REMOVE LIST
// listen for clicks on 'delete list'
const removeListButton = document.getElementsByClassName('delList');
for (i = 0; i < removeListButton.length; i++){
	removeListButton[i].addEventListener('click', function(event){
		var id = event.target.id;
		var modal = document.getElementById('deleteModal');
		var confirm = document.getElementById('deleteConfirm');
		var cancel = document.getElementById('deleteCancel');
		// make the modal visible
		modal.style.display = "block";
		// event listeners for further clicks on Yes or No.
		confirm.addEventListener('click', removeList);
		cancel.addEventListener('click', hideCheckModal);

		function hideCheckModal() {
			var modal = document.getElementById('deleteModal');
			var confirm = document.getElementById('deleteConfirm');
			var cancel = document.getElementById('deleteCancel');
			// cancel eventlisteners
			// if you don't do this, it will delete every list you clicked 'delete' on,
			// even if you cancelled it, because the eventlistener is still active 😧
			confirm.removeEventListener('click', removeList);
			cancel.removeEventListener('click', hideCheckModal);
			// hide modal
			modal.style.display = "none";
		}

		// AJAX call to remove list
		function removeList(){
			const req = new XMLHttpRequest();
			// this is effectively a callback on the request
			req.addEventListener('load', function(){
				var response = JSON.parse(this.responseText);
				var listHeader = document.querySelector(`#${id}`);
				var listDetails = document.querySelector(`[name=${id}]`);
				if (response.result === 'success') {
					// delete the list elements
					listHeader.parentNode.removeChild(listHeader);
					listDetails.parentNode.removeChild(listDetails);
					// cleanup
					hideCheckModal()
				} else {
					var failDiv = document.createElement('div');
					failDiv.className = 'fail';
					var failText = document.createTextNode('something went wrong');
					failDiv.appendChild(failText);
					listing.appendChild(failDiv);
					console.error('error')
				}
			});

			req.open('GET', `${window.location.protocol}//${window.location.host}/dashboard/removelist/${id}`, true);
			req.setRequestHeader('enctype', 'text/plain')
			req.send();
		}
	});
}

// REMOVE FEED
// listen for clicks on 'delete list'
var removeFeedButton = document.getElementsByClassName('delFeed');
for (i = 0; i < removeFeedButton.length; i++){
	removeFeedButton[i].addEventListener('click', function(event){
		var element = event.target.parentNode;
		var id = event.target.id;
		var listName = event.target.parentNode.parentNode.getAttribute('name');
		var modal = document.getElementById('deleteModal');
		var confirm = document.getElementById('deleteConfirm');
		var cancel = document.getElementById('deleteCancel');
		// make the modal visible
		modal.style.display = "block";
		// event listeners for further clicks on Yes or No.
		confirm.addEventListener('click', removeFeed);
		cancel.addEventListener('click', hideCheckModal);

		function hideCheckModal() {
			var modal = document.getElementById('deleteModal');
			var confirm = document.getElementById('deleteConfirm');
			var cancel = document.getElementById('deleteCancel');
			// cancel eventlisteners
			// if you don't do this, it will delete every feed you clicked 'delete' on,
			// even if you cancelled it, because the eventlistener is still active 😧
			confirm.removeEventListener('click', removeFeed);
			cancel.removeEventListener('click', hideCheckModal);
			// hide modal
			modal.style.display = "none";
		}

		function removeFeed(){
			const req = new XMLHttpRequest();
			req.addEventListener('load', function(){
				var response = JSON.parse(this.responseText);
				if (response.result === 'success') {
						// delete the element
						element.parentNode.removeChild(element);
						// hide modal
						modal.style.display = "none";
				} else {
					var failDiv = document.createElement('div');
					failDiv.className = 'fail';
					var failText = document.createTextNode('something went wrong');
					failDiv.appendChild(failText);
					listing.appendChild(failDiv);
					console.log('error')
				}
			});
			req.open('GET', `${window.location.protocol}//${window.location.host}/lists/removefeed/${listName}/${id}`, true);
			req.setRequestHeader('enctype', 'text/plain')
			req.send();
		}
	})
}

// ADD LIST
const addList = document.getElementById('addListButton');
addList.addEventListener('click', function(event){
	event.stopPropagation();

	// function to cancel and hide modal
	function cancelAddList(event) {
		event.preventDefault();
		//clear text field
		document.getElementById('newListName').value = "";
		// hide modal
		modal.style.display = "none";
	}

	// show the modal
	var modal = document.getElementById('newListModal');
	modal.style.display = "block";
	// hide the modal if the user clicks cancel
	var cancelAdd = document.getElementById('addListCancel');
	cancelAdd.addEventListener('click', cancelAddList);
	// if the user adds a URL and click 'Add' the form will take care of it so no need for anything else here.
});

// ADD FEED
const addFeed = document.getElementsByClassName('addFeedButton');
// add an event listener to the 'addFeedButton' in each feed
for (feed of addFeed) {
	feed.addEventListener('click', function(event){

		// function to cancel and hide modal
		function cancelAddFeed(event) {
			event.preventDefault();
			//clear text field
			document.getElementById('feedUrl').value = "";
			// hide modal
			addFeedModal.style.display = "none";
		}
		// show the modal
		var addFeedModal = document.querySelector('#newFeedModal');
		var targetSuffix = `${event.target.id}/addfeed`;
		var formTarget = document.querySelector('#addFeedForm');
		formTarget.setAttribute('action', `${formTarget.action}/${targetSuffix}`)
		addFeedModal.style.display = "block";
		// hide the modal if the user clicks cancel
		var cancelAddF = document.getElementById('addFeedCancel');
		cancelAddF.addEventListener('click', cancelAddFeed);
		// if the user adds a URL and click 'Add' the form will take care of it so no need for anything else here.
	})
}

// LISTEN FOR 'PUBLIC' LIST TOGGLES
const publicToggles = document.getElementsByClassName('publicToggle');
for (toggle of publicToggles) {
	toggle.onchange=publicToggle;
}

function publicToggle() {
	const name = this.getAttribute('id');
	const checked = this.checked;
	// post to server to change setting in DB
	const req = new XMLHttpRequest();

	req.addEventListener('load', function(){
		var response = this.responseText;
	});
	// post to server
	req.open('POST', `${window.location.protocol}//${window.location.host}/lists/toggle/${name}/${checked}`, true);
	req.setRequestHeader('enctype', 'text/plain')
	req.send();
}

// SUBSCRIBE TOGGLE
// for each list, monitor the state of the subscribe toggle
const lists = document.getElementsByClassName('subToggle');
for (list of lists) {
	list.onchange=subscribeToggle
}

// add or remove subscription depending on current state
function subscribeToggle() {
	const id = this.getAttribute('id');
	const sub = this.checked;
	// post to server to change setting in DB
	const req = new XMLHttpRequest();
	req.open('POST', `${window.location.protocol}//${window.location.host}/lists/subscribe/${id}-${sub}`, true);
	req.setRequestHeader('enctype', 'text/plain')
	req.send();
}