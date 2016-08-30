'use strict';

var xenaQuery = require("./xenaQuery");
var domHelper = require("./dom_helper");
var _ = require("./underscore_ext");
var controller = require("./controller");


var defaultLocal = "https://local.xena.ucsc.edu:7223",
	//defaultUCSC = "https://genome-cancer.ucsc.edu:443/proj/public/xena",
	defaultUCSC = "https://ucscpublic.xenahubs.net",
	defaultTCGA = "https://tcga.xenahubs.net",
	defaultICGC = "https://icgc.xenahubs.net",
	defaultTOIL = "https://toil.xenahubs.net",
	defaultPCAWG = "https://pcawg.xenahubs.net",
	defaultNames = {},
	defaultAllHubs,
	defaultHosts,
	GOODSTATUS = "loaded";

defaultNames[defaultLocal] = "My computer hub";
defaultNames[defaultUCSC] = "UCSC public hub";
defaultNames[defaultTCGA] = "TCGA hub";
defaultNames[defaultICGC] = "ICGC hub";
defaultNames[defaultTOIL] = "GA4GH-BD2K (TOIL) hub";
defaultNames[defaultPCAWG] = "PCAWG public hub";

defaultAllHubs = [
	defaultLocal,
	defaultUCSC,
	defaultTCGA,
	defaultICGC,
	defaultTOIL,
];

defaultHosts = [
	defaultLocal,
	defaultTCGA,
	defaultUCSC,
	defaultICGC,
	defaultTOIL,
];

var xenaStateResets = {
		mode: 'heatmap',
		zoom: {height: 300},
		columns: {},
		columnOrder: [],
		samples: []
	};
var xenaStateInit = {...xenaStateResets, servers: {user: []}};

function sessionStorageCallback(ev) {
	var state = sessionStorage.xena ? JSON.parse(sessionStorage.xena) : xenaStateInit;
	sessionStorage.xena = JSON.stringify(controller.action(state, ev));
}

var callback = sessionStorageCallback;

function xenaHeatmapSetCohort(cohortname) {
	callback(['cohort', cohortname]);
}

//set xena user server
function setXenaUserServer() {
	let {activeHosts, userHosts} = JSON.parse(sessionStorage.state),
		servers = _.intersection(activeHosts, userHosts);
	callback(['servers', servers]);
}

function getSessionStorageState () {
	return sessionStorage.state ? JSON.parse(sessionStorage.state) : {};
}

function addHostToListInSession(list, host) {
	var state = JSON.parse(sessionStorage.state);
	state[list] = _.union(state[list], [host]);
	sessionStorage.state = JSON.stringify(state);
	setXenaUserServer();
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
	var state = JSON.parse(sessionStorage.state);
	state[list] = _.difference(state[list], [host]);
	sessionStorage.state = JSON.stringify(state);
	setXenaUserServer();
}

function updateHostStatus(host) {
	var userHosts = JSON.parse(sessionStorage.state).userHosts;
	addHostToListInSession('allHosts', host);

	xenaQuery.test_host(host).subscribe(function (s) {
		if (s) {
			// test if host can return useful data
			var start = Date.now();
			xenaQuery.all_cohorts(host).subscribe(function (s) {
				var duration;
				if (s.length > 0) {
					addHostToListInSession('activeHosts', host);
					updateHostDOM(host, (userHosts.indexOf(host) !== -1) ? 'live_selected' : 'live_unselected');
				} else {
					duration = Date.now() - start;
					removeHostFromListInSession('activeHosts', host);
					updateHostDOM(host, (duration > 3000) ? 'slow' : 'nodata');
				}
			});
		} else {
			removeHostFromListInSession('activeHosts', host);
			updateHostDOM(host, 'dead');
		}
	});
}

function sessionStorageInitialize() {
	var defaultState = {
			activeHosts: defaultHosts,
			allHosts: defaultAllHubs,
			userHosts: defaultHosts,
			localHost: defaultLocal,
			metadataFilterHosts: defaultHosts
		},
		state = getSessionStorageState();

	state = _.extend(defaultState, state);
	sessionStorage.state = JSON.stringify(state);

	state.allHosts.forEach(function(host) {
		updateHostStatus(host); // only currently update sessinostorage, not state ( :( )
	});

	setXenaUserServer();
}

function getHubName(host) {
	if (defaultNames[host]) {
		return defaultNames[host];
	}
	else {
		return host;
	}
}

function hostCheckBox(host) {
	var userHosts = JSON.parse(sessionStorage.state).userHosts,
		node = domHelper.elt("div"),
		checkbox = document.createElement("INPUT"),
		labelText = domHelper.elt('label');

	function checkBoxLabel() {
		if (checkbox.checked) {
			labelText.style.color = "gray";
			labelText.innerHTML = "selected";
		}
		else {
			labelText.innerHTML = "&nbsp";
		}
		updateHostStatus(host);
	}

	checkbox.setAttribute("type", "checkbox");
	checkbox.setAttribute("id", "checkbox" + host);
	checkbox.setAttribute("class", "hubcheck");
	checkbox.checked = _.contains(userHosts, host);
	labelText.setAttribute("for", "checkbox" + host);
	labelText.setAttribute("id", "hubLabel" + host);
	checkBoxLabel();

	node.appendChild(checkbox);
	node.appendChild(labelText);

	checkbox.addEventListener('click', function () {
		var checked = checkbox.checked,
			stateJSON = JSON.parse(sessionStorage.state);

		if (checked !== _.contains(stateJSON.userHosts, host)) {
			if (checked) { // add host
				addHostToListInSession('userHosts', host);
				addHostToListInSession('metadataFilterHosts', host);
			} else { // remove host
				removeHostFromListInSession('userHosts', host);
				removeHostFromListInSession('metadataFilterHosts', host);

				//check if host that will be removed has the "cohort" in the xena heatmap state setting ///////////TODO
// XXX This seems wrong. If the cohort is on multiple hosts, it still resets the heatmap.
//					xenaQuery.all_cohorts(host).subscribe(function (s) {
//						var xenaState = JSON.parse(sessionStorage.xena);
//						if (xenaState.cohort && _.contains(s, xenaState.cohort)) { // reset xenaHeatmap
//							xenaHeatmapStateReset();
//						}
//					});
			}
			setXenaUserServer();
			checkBoxLabel();
		}
	});

	return node;
}

function metaDataFilterCheckBox(host, ifChangedAction) {
	var metadataFilterHosts = JSON.parse(sessionStorage.state).metadataFilterHosts,
			checkbox = document.createElement("INPUT");

	checkbox.setAttribute("type", "checkbox");
	checkbox.setAttribute("id", "checkbox" + host);
	checkbox.checked = _.contains(metadataFilterHosts, host);

	checkbox.addEventListener('click', function () {
		var checked = checkbox.checked,
			stateJSON = JSON.parse(sessionStorage.state);

		if (checked !== _.contains(stateJSON.metadataFilterHosts, host)) {
			if (checked) { // add host
				addHostToListInSession('metadataFilterHosts', host);
			} else { // remove host
				removeHostFromListInSession('metadataFilterHosts', host);
			}
			if (ifChangedAction) {
				ifChangedAction.apply(null, arguments);
			}
		}
	});

	return checkbox;
}

module.exports = {
	sessionStorageInitialize: sessionStorageInitialize,
	updateHostStatus: updateHostStatus,
	hostCheckBox: hostCheckBox,
	metaDataFilterCheckBox: metaDataFilterCheckBox,
	xenaHeatmapSetCohort: xenaHeatmapSetCohort,
	getHubName: getHubName,
	setCallback: cb => {callback = cb;},

	GOODSTATUS: GOODSTATUS
};
