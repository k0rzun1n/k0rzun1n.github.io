let cc = console.log;
(function ($) {
	jQuery.noConflict();
	let pushEmpty = true;
	window.onpopstate = function () {
		cc("wonpop");
		let open_modal = document.querySelector('.modal.show')
		if (window.location.hash == "" && open_modal) {
			pushEmpty = false;
			$(open_modal).modal('hide')
		}
		if (window.location.hash != "" && !open_modal) {
			cc("#modal-" + window.location.hash.slice(1));
			$("#modal-" + window.location.hash.slice(1)).modal('show');
		}
	}

	for (let el of document.getElementsByClassName('prjTile')) {
		let m = $('#modal-' + el.id);
		m.on('hidden.bs.modal', (e) => {
			cc("hidn")
			if (pushEmpty)
				history.pushState(null, null, ' ');
			pushEmpty = true;
		})
		//onshown?
		m.on('shown.bs.modal', (e) => {
			cc("shwn")
		})
		el.onclick = function () {
			m.modal('show');
			history.pushState(null, null, '#' + el.id);
		};
	}

	// $('#modal-p2').modal('show');
	$(window.location.hash).click();

})(jQuery);










