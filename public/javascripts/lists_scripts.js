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
