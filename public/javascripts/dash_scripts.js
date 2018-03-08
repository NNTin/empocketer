// REMOVE LIST
// listen for clicks on 'delete list'
var removeButton = document.getElementsByClassName('delList');
for (i = 0; i < removeButton.length; i++){
	removeButton[i].addEventListener('click', function(event){
		var id = event.target.id;
		var modal = document.getElementById('deleteListModal');
		var confirm = document.getElementById('deleteListConfirm');
		var cancel = document.getElementById('deleteListCancel');
		// make the modal visible
		modal.style.display = "block";
		// event listeners for further clicks on Yes or No.
		confirm.addEventListener('click', removeList);
		cancel.addEventListener('click', hideCheckModal);

		function hideCheckModal() {
			var modal = document.getElementById('deleteListModal');
			var confirm = document.getElementById('deleteListConfirm');
			var cancel = document.getElementById('deleteListCancel');
			// cancel eventlisteners
			confirm.removeEventListener('click', removeList);
			cancel.removeEventListener('click', hideCheckModal);
			// change name back
			confirm.setAttribute('name', '');
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
					hideCheckModal(modal, confirm, cancel)
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

// ADD LIST
var addList = document.getElementById('addListButton');
addList.addEventListener('click', function(event){
	event.stopPropagation();

	// function to cancel and hide modal
	function cancelAddList(event) {
		event.preventDefault();
		modal.style.display = "none";
	}

	// show the modal
	var modal = document.getElementById('newListModal');
	modal.style.display = "block";
	// hide the modal if the user click cancel
	var cancelAdd = document.getElementById('addListCancel');
	cancelAdd.addEventListener('click', cancelAddList);
});

// ADD FEED
var addFeed = document.getElementsByClassName('addFeedButton');
// add an event listener to the 'addFeedButton' in each feed
for (feed of addFeed) {
	feed.addEventListener('click', function(event){

		// function to cancel and hide modal
		function cancelAddFeed(event) {
			event.preventDefault();
			cancelAddF.removeEventListener('click', cancelAddFeed);
			addFeedModal.style.display = "none";
		}
		// show the modal
		var addFeedModal = document.querySelector('#newFeedModal');
		var targetSuffix = `${event.target.id}/addfeed`;
		var formTarget = document.querySelector('#addFeedForm');
		formTarget.setAttribute('action', `${formTarget.action}/${targetSuffix}`)
		addFeedModal.style.display = "block";
		// hide the modal if the user click cancel
		var cancelAddF = document.getElementById('addFeedCancel');
		cancelAddF.addEventListener('click', cancelAddFeed);
		// if the user adds a URL and click 'Add' the form will take care of it so no need for anything here.
	})
}


