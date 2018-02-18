// AJAX call to remove feed

function removeFeed(frag){
	const req = new XMLHttpRequest();
	req.addEventListener('load', function(){
		var response = JSON.parse(this.responseText);
		var listing = document.querySelector(`li[name=${frag}]`);
		if (response.result === 'success') {
				// delete the element
				listing.parentNode.removeChild(listing);
		} else {
			var failDiv = document.createElement('div');
			failDiv.className = 'fail';
			var failText = document.createTextNode('something went wrong');
			failDiv.appendChild(failText);
			listing.appendChild(failDiv);
			console.log('error')
		}
	});
	req.open('GET', `${window.location.protocol}//${window.location.host}/lists/removefeed/${frag}`, true);
	req.setRequestHeader('enctype', 'text/plain')
	req.send();
}

function cancelDeletion(cancel, id){
	var title = document.querySelector(`a[name=${id}]`);
	var button = document.getElementById(id);
	// remove cancel button completely
	cancel.parentNode.removeChild(cancel);
	// change confirm button back
	button.setAttribute('class', 'delList');
	button.textContent ='delete';
	// change text back
	title.removeAttribute('class');
}

function getDelButton(id){
	var delButton = document.querySelector('.confirm');
	var cancelButton = document.querySelector('.undelete');

	function confirm(event){
		// now check the feed and delete the listing once confirmed
		removeFeed(id)
	}

	function cancel(event){
		// we need to remove the confirm eventListener, otherwise the next delete click will be treated as a confirm.
		delButton.removeEventListener('click', confirm);
		cancelDeletion(event.target, id)
	}

	delButton.addEventListener('click', confirm);
	cancelButton.addEventListener('click', cancel);
}

// this runs on page load
var removeButton = document.getElementsByClassName('removeButton');
for (i = 0; i < removeButton.length; i++){
	removeButton[i].addEventListener('click', function(event){
		event.preventDefault();
		var id = event.target.id;

		// change delete button to confirm button
		var button = event.target;
		var title = document.querySelector(`a[name=${id}]`);
		title.setAttribute('class', 'strikeout');
		button.setAttribute('class', 'confirm');
		button.textContent = 'Confirm deletion';

		// remove the hint if there is one
		var hint = document.getElementsByClassName("hint")[0];
		if (hint) {
			hint.parentNode.removeChild(hint);
		}

		// add an undelete button
		var undelete = document.createElement("button");
		undelete.setAttribute('class', 'undelete');
		undelete.textContent = 'Cancel';
		button.parentElement.appendChild(undelete);
		// we need to call this as a function otherwise it only runs on page load
		getDelButton(id)
	});
}