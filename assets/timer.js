
var timer = {
	// where we keep the time info
	data: {},
};

// DOM event handlers
$.extend(timer, {
	noOp: function(ev) {
		return false;
	},

	updateTimeTag: function(ev) {
		var newTag = $(this).val(),
			option = $('<option>')
				.attr({value: newTag, selected: true})
				.text(newTag);
		$('select[name="timetag"]').append(option);
		$(this).val('');
		localStorage.setItem('timer.currentCat', selected);
		timer.refreshDisplay(ev, newTag);
	},

	selectTimeTag: function(ev) {
		var selected = $(this).val();
		localStorage.setItem('timer.currentCat', selected);
		timer.refreshDisplay(ev, selected);
	},

});

timer.errorHandler = function(xhr, status, error) {
	console.log(xhr, status, error);
};

/*
 * display an amount of seconds as hours and such
 */
timer.timeString = function(seconds) {

	if (!seconds) {
		return 'new';
	}

	var lSeconds = seconds % 60,
		minutes = parseInt(seconds/60),
		lMinutes = minutes % 60,
		hours = parseInt(minutes/60);

	return hours + ':' + lMinutes + '.' + lSeconds;
}

/*
 * Update the list display of total info.
 */
timer.updateTotals = function() {
	var cats = Object.keys(timer.data);

	$('#totals').empty();
	$.each(cats, function(index, cat) {
		var totalInfo = $('<li>').text(cat + ' ' +
			timer.timeString(timer.data[cat].total));
		$('#totals').append(totalInfo);
	});
};

/*
 * Show the results for the current category in the button.
 */
timer.changeCurrent = function(cat) {
	$('#action').text(timer.timeString(timer.data[cat].total))
		.attr('class', (timer.data[cat].on ? 'on' : 'off'));
};

timer.refreshDisplay = function(ev, data) {

	$('#action').attr('disabled', false);

	console.log('data', typeof data);
	if (typeof data === 'string') {
		if (!timer.data[data]) {
			timer.data[data] = {};
			timer.data[data]['start'] = [];
			timer.data[data]['stop'] = [];
		}
		return timer.changeCurrent(data);
	}

	function setSelect(cats) {
		var selector = $('select[name="timetag"]');
		selector.empty();
		$.each(cats, function(index, cat) {
			var	option = $('<option>')
					.attr({value: cat, selected: true})
					.text(cat);
			selector.append(option);
		});
	}

	function zipToType(starts, stops) {
		var tuples = [];

		// not hugely DRY
		$.each(starts, function(index, start) {
			tuples.push(['start', start]);
		});
		$.each(stops, function(index, stop) {
			tuples.push(['stop', stop]);
		});

		tuples = tuples.sort(function(a, b) {
			return (a[1] - b[1]);
		});

		return tuples;
	}

	function flushUntilDifferent(type, tuples) {
		var removals = [];

		$.each(tuples, function(index, tuple) {
			if (tuple[0] === type) {
				removals.push(tuple);
			} else {
				return false;
			}
		});

		return removals;
	}

	function deGap(type, tuples) {
		var removals = [],
			index = 0,
			lengthTuples = tuples.length;
		$.each(tuples, function(index, tuple) {
			if (tuple[0] === type) {
				removals = removals.concat(flushUntilDifferent(
						type, tuples.slice(index + 1)));
			}
			index += 1
		})

		$.each(removals, function(index, removeme) {
			var index = tuples.indexOf(removeme);
			if (index !== -1) {
				tuples.splice(index, 1);
			}
		});

		return tuples;
	}

	function totaller(tuples, cat) {
		var total = 0,
			start,
			stop;
		timer.data[cat].on = false;
		while (1) {
			start = tuples.shift();
			if (!start) {
				return total;
			}
			start = start[1];
			stop = tuples.shift();
			if (!stop) {
				timer.data[cat].on = true;
				stop = Math.round(new Date().getTime() / 1000);
			} else {
				stop = stop[1];
			}
			total += (stop - start);
		}
	}


	function calculateTime(timeInfo, cat) {
		var	starts = timeInfo.start,
			stops = timeInfo.stop;
		return totaller(
					deGap('stop',
						deGap('start',
							zipToType(starts, stops))), cat);
	}

	
	// gather data from tiddlers
	$.each(data, function(index, tiddler) {
		var tags = tiddler.tags,
			tagMap;
		// array to hash
		$.each(tags, function(index, tag) {
			if (tag.match(/timer:/)) {
				var info = tag.split(/:/)[1].split(/-/),
					cat = info[0],
					state = info[1];
				if (!timer.data[cat]) {
					timer.data[cat] = {};
					timer.data[cat]['start'] = [];
					timer.data[cat]['stop'] = [];
				}
				timer.data[cat][state].push(tiddler.title);
			}
		});
	});
	var cats = Object.keys(timer.data);
	setSelect(cats);
	$.each(cats, function(index, cat) {
		timer.data[cat]['total'] = calculateTime(timer.data[cat], cat);
		console.log('total', timer.data[cat].total, timer.data[cat].on);
	});
	timer.updateTotals();

	var currentCat = localStorage.getItem('timer.currentCat') || 'test';
	$('select[name="timetag"]').val(currentCat);
	timer.changeCurrent(currentCat);
};

// get all the current time info
// XXX: destaticify
timer.loadTags = function() {
	var searchURI = '/search.json?q=bag:timer_public%20tag:"timer:*"';
	$('#action').text('loading...').attr('disabled', true);
	$.ajax({
		url: searchURI,
		success: function(data) {
			$(document).trigger('tagsloaded', [data]);
		},
		error: timer.errorHandler
	});
};

/* 
 * Create a new tiddler either starting of stop in the current tag.
 */
timer.startStop = function(ev) {
	var button = $(this),
		cat = $('select[name="timetag"]').val(),
		timestamp = Math.round(new Date().getTime() / 1000),
		annotation = $('textarea').val(),
		tag,
		uri = '/bags/timer_public/tiddlers/' + timestamp,
		tiddler;

	if (timer.data[cat].on) {
		tag = 'timer:' + cat + '-stop';
	} else {
		tag = 'timer:' + cat + '-start';
	}

	tiddler = {
		tags: [tag],
		text: annotation,
	};

	console.log('putting tiddler', timer.data[cat], timestamp, tag);

	$.ajax({
		url: uri,
		type: 'PUT',
		contentType: 'application/json',
		data: JSON.stringify(tiddler),
		success: timer.loadTags,
		error: timer.errorHandler
	});
};

timer.init = function() {
	// bind form events
	$('input[name="newtimetag"]').on('change', timer.updateTimeTag);
	$('select[name="timetag"]').on('change', timer.selectTimeTag);
	$('form').on('submit', timer.noOp);
	$('#action').on('click', timer.startStop);
	$(document).on('tagsloaded', timer.refreshDisplay);
	timer.loadTags();
};

$(function() {
	timer.init();
});
