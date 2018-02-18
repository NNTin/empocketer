// AJAX call to remove list
function removeList(id){
	const req = new XMLHttpRequest();
	req.addEventListener('load', function(){
		var response = JSON.parse(this.responseText);
		var listing = document.querySelector(`[name=${id}]`);
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
	req.open('GET', `${window.location.protocol}//${window.location.host}/dashboard/removelist/${id}`, true);
	req.setRequestHeader('enctype', 'text/plain')
	req.send();
}

// listen for delete confirmation
function getDelButton(id){
	var delButton = document.querySelector('.confirm');
	delButton.addEventListener('click', function(event){
		// now check the list and delete the listing once confirmed
		removeList(id)
	})
}

// change delete button to a confirm button
// TODO create cancel button
var removeButton = document.getElementsByClassName('delList');
for (i = 0; i < removeButton.length; i++){
	removeButton[i].addEventListener('click', function(event){
		event.preventDefault();
		var id = event.target.id;
		var button = event.target;
		var title = document.querySelector(`a[name=${id}]`);
		title.setAttribute('class', 'strikeout');
		button.setAttribute('class', 'confirm');
		button.textContent = 'Confirm you want to delete this list';
		// we need to call this as a function otherwise it only runs on page load
		getDelButton(id)
	});
}