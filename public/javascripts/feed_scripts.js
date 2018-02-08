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

var removeButton = document.getElementsByClassName('removeButton');
for (i = 0; i < removeButton.length; i++){
	removeButton[i].addEventListener('click', function(event){
		event.preventDefault();
		var id = event.target.id;
		var button = event.target;
		var title = document.querySelector(`a[name=${id}]`);
		title.setAttribute('class', 'strikeout');
		button.setAttribute('class', 'confirm');
		button.textContent = 'Confirm deletion';
		// we need to call this as a function otherwise it only runs on page load
		getDelButton()
	});
}

function getDelButton(){
	var delButton = document.getElementsByClassName('confirm');
	for (i=0; i < delButton.length; i++){
		delButton[i].addEventListener('click', function(event){
			// now check the feed and delete the listing once confirmed
			removeFeed(event.target.id)
		})
	}
}