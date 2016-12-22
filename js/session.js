'use strict';

var xenaQuery = require("./xenaQuery");
var domHelper = require("./dom_helper");
var controller = require("./controller");


var {defaultLocal, defaultUCSC, defaultTCGA, defaultICGC, defaultTOIL,
	defaultPCAWG} = require('./defaults');

var defaultNames = {},
	GOODSTATUS = "loaded";

defaultNames[defaultLocal] = "My computer hub";
defaultNames[defaultUCSC] = "UCSC public hub";
defaultNames[defaultTCGA] = "TCGA hub";
defaultNames[defaultICGC] = "ICGC hub";
defaultNames[defaultTOIL] = "GA4GH-BD2K (TOIL) hub";
defaultNames[defaultPCAWG] = "PCAWG public hub";

var xenaState;
var activeHosts = new Set();

function sessionStorageCallback(ev) {
	throw new Error('sessionStorageCallback is broken');
	xenaState = controller.action(xenaState, ev);
}

var callback = sessionStorageCallback;

function xenaHeatmapSetCohort(cohortname) {
	callback(['cohort', cohortname]);
}

function addHostToListInSession(list, host) {
	callback(['enable-host', host, list]);
}

function updateHostDOM(host, status) {
	var display = {
			'live_selected': {msg: '', el: 'result'},
			'live_unselected': {msg: ' (running, not in my data hubs)', el: 'result2'},
			'dead': {msg: ' (not running)', el: 'result2'},
			'nodata': {msg: ' (no data)', el: 'result2'},
			'slow': {msg: ' (there is a problem)', el: 'result2'}
		},
		displayHubPage = {
			'live_selected': {msg: '', el: 'result'},
			'live_unselected': {msg: '', el: 'result'},
			'dead': {msg: ' (not running)', el: 'result2'},
			'nodata': {msg: ' (no data)', el: 'result2'},
			'slow': {msg: ' (there is a problem)', el: 'result2'}
		},
		displayHubLabel = {
			'live_selected': {msg: 'connected', color: 'blue'},
			'live_unselected': {msg: '&nbsp', color: 'white'}
		},

		node = document.getElementById("status" + host),
		sidebarNode = document.getElementById("sidebar" + host),
		sidebarCheck = document.getElementById("sidebarCheck" + host),
		nodeHubPage = document.getElementById("statusHub" + host),
		nodeHubLabel = document.getElementById("hubLabel" + host),
		nodeHubCheck = document.getElementById("checkbox" + host),
		shortLabel = defaultNames[host] ? defaultNames[host] : host;

	if (node) {
		node.parentNode.replaceChild(
			domHelper.elt(display[status].el, domHelper.hrefLink(shortLabel + display[status].msg,
				"../datapages/?host=" + host)), node);
	}
	if (sidebarNode && (status === "dead" || status === "slow")) {
		sidebarNode.parentNode.removeChild(sidebarNode);
		sidebarCheck.parentNode.removeChild(sidebarCheck);
	}
	if (sidebarNode && (status === "live_selected" || status === "live_unselected" || status === "nodata")) {
			sidebarNode.parentNode.replaceChild(
				domHelper.elt(display[status].el, domHelper.hrefLink(shortLabel + displayHubPage[status].msg,
					"../datapages/?host=" + host)), sidebarNode);
	}
	if (nodeHubPage) {
		nodeHubPage.parentNode.replaceChild(
			domHelper.elt(displayHubPage[status].el, domHelper.hrefLink(shortLabel + displayHubPage[status].msg,
				"../datapages/?host=" + host)), nodeHubPage);
	}
	if (nodeHubLabel && displayHubLabel[status]) {
		if (displayHubLabel[status].color) {
			nodeHubLabel.style.color = displayHubLabel[status].color;
			nodeHubCheck.style.background = "linear-gradient(" + displayHubLabel[status].color + ", white)";
		}
		if (displayHubLabel[status].msg) {
			nodeHubLabel.innerHTML = displayHubLabel[status].msg;
		}
	}
}

function removeHostFromListInSession(list, host) {
	callback(['disable-host', host, list]);
}

function updateHostStatus(host) {
	xenaQuery.test_host(host).subscribe(function (s) {
		if (s) {
			// test if host can return useful data
			var start = Date.now();
			xenaQuery.all_cohorts(host).subscribe(function (s) {
				var duration;
				if (s.length > 0) {
					activeHosts.add(host);
					updateHostDOM(host, xenaState[host].user ? 'live_selected' : 'live_unselected');
				} else {
					duration = Date.now() - start;
					activeHosts.delete(host);
					updateHostDOM(host, (duration > 3000) ? 'slow' : 'nodata');
				}
			});
		} else {
			activeHosts.delete(host);
			updateHostDOM(host, 'dead');
		}
	});
}

function getHubName(host) {
	if (defaultNames[host]) {
		return defaultNames[host];
	}
	else {
		return host;
	}
}


function metaDataFilterCheckBox(host, ifChangedAction) {
	var checkbox = document.createElement("INPUT");

	checkbox.setAttribute("type", "checkbox");
	checkbox.setAttribute("id", "checkbox" + host);
	checkbox.checked = xenaState[host].user;

	checkbox.addEventListener('click', function () {
		var checked = checkbox.checked;

		if (checked !== xenaState[host].user) {
			if (checked) { // add host
				addHostToListInSession('user', host);
			} else { // remove host
				removeHostFromListInSession('user', host);
			}
			if (ifChangedAction) {
				ifChangedAction.apply(null, arguments);
			}
		}
	});

	return checkbox;
}

module.exports = {
	activeHosts,
	updateHostStatus: updateHostStatus,
	metaDataFilterCheckBox: metaDataFilterCheckBox,
	xenaHeatmapSetCohort: xenaHeatmapSetCohort,
	getHubName: getHubName,
	setCallback: cb => {callback = cb;},
	setState: state => {xenaState = state;},

	GOODSTATUS: GOODSTATUS
};
