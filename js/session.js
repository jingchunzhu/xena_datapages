/*eslint strict: [2, "function"], camelcase: 0, no-use-before-define: 0 */
/*eslint-env browser */
/*global define: false */
define(["xenaQuery", "rx", "dom_helper", "underscore_ext"], function (xenaQuery, Rx, dom_helper, _) {
	'use strict';

	var defaultLocal = "https://local.xena.ucsc.edu:7223",
		defaultUCSC = "https://genome-cancer.ucsc.edu:443/proj/public/xena",
		defaultTCGA = "http://ec2-52-9-44-211.us-west-1.compute.amazonaws.com:7222",
		defaultICGC = "http://ec2-52-9-44-211.us-west-1.compute.amazonaws.com:7224",
		defaultTOIL = "http://ec2-52-9-44-211.us-west-1.compute.amazonaws.com:7226",
		defaultTreehouse = "http://ec2-52-8-94-52.us-west-1.compute.amazonaws.com:7222",
		defaultNames = {},
		defaultAllHubs,
		defaultHosts,
		GOODSTATUS = "loaded",
		sessionStorage = window.sessionStorage;

	defaultNames[defaultLocal] = "Your computer hub";
	defaultNames[defaultUCSC] = "UCSC public main hub (release Nov 2015)";
	defaultNames[defaultTCGA] = "TCGA hub";
	defaultNames[defaultICGC] = "ICGC hub";
	defaultNames[defaultTOIL] = "TOIL hub";
	defaultNames[defaultTreehouse] = "Treehouse hub";

	defaultAllHubs = [
		defaultUCSC,
		defaultTCGA,
		defaultICGC,
		defaultTOIL,
		defaultTreehouse,
		defaultLocal
	];

	defaultHosts = [
		defaultUCSC,
		defaultLocal
	];

	function xenaHeatmapStateReset() {
		var xenaStateResets = {
				mode: 'heatmap',
				zoom: {height: 300},
				columns: {},
				columnOrder: [],
				samples: []
			},
			state = sessionStorage.xena ? JSON.parse(sessionStorage.xena) : {servers: {user: []}};
		sessionStorage.xena = JSON.stringify(_.extend(state, xenaStateResets));
	}

	function xenaHeatmapSetCohort(cohortname) {
		var xenaState = {
				cohort: cohortname
			},
			state = sessionStorage.xena ? JSON.parse(sessionStorage.xena) : {servers: {user: []}};

		if ( state.cohort && state.cohort !== cohortname) {
			xenaHeatmapStateReset();
			state = sessionStorage.xena ? JSON.parse(sessionStorage.xena) : {servers: {user: []}};
		}
		sessionStorage.xena = JSON.stringify(_.extend(state, xenaState));
	}

	//set xena user server
	function setXenaUserServer() {
		if (!sessionStorage.xena) {
			xenaHeatmapStateReset();
		}

		var state = JSON.parse(sessionStorage.xena);

		state.servers.user = _.intersection(JSON.parse(sessionStorage.state).activeHosts,
			JSON.parse(sessionStorage.state).userHosts);

		sessionStorage.xena = JSON.stringify(state);
	}

	// XXX should not have subscribe inside a subscribe. Instead,
	// use a combinator on the two streams & subscribe to the result.
	function datasetHasFloats (host, dsName, action, actionArgs) {
		xenaQuery.dataset_field_examples(host, dsName).subscribe(function (s) {
			var probes = s.map(function (probe) {
				return probe.name;
			});
			xenaQuery.code_list(host, dsName, probes).subscribe(function(codemap){
				for(var key in codemap) {
					if (codemap.hasOwnProperty(key) && !codemap[key]){  // no code, float feature
						action.apply(this, actionArgs);
						return;
					}
		    }
			});
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

		state.allHosts.forEach(function(host){
			updateHostStatus(host); // only currently update sessinostorage, not state ( :( )
		});

		setXenaUserServer();
	}

	function getHubName(host){
		if (defaultNames[host]){
			return defaultNames[host];
		}
		else {
			return host;
		}
	}

	function getSessionStorageState () {
		return sessionStorage.state ? JSON.parse(sessionStorage.state) : {};
	}

	function removeHostFromListInSession(list, host) {
		var state = JSON.parse(sessionStorage.state);
		state[list] = _.difference(state[list], [host]);
		sessionStorage.state = JSON.stringify(state);
		setXenaUserServer();
	}

	function addHostToListInSession(list, host) {
		var state = JSON.parse(sessionStorage.state);
		state[list] = _.union(state[list], [host]);
		sessionStorage.state = JSON.stringify(state);
		setXenaUserServer();
	}

	function hostCheckBox(host) {
		var userHosts = JSON.parse(sessionStorage.state).userHosts,
			node = dom_helper.elt("div"),
			checkbox = document.createElement("INPUT"),
			labelText = dom_helper.elt('label');

		function checkBoxLabel() {
			if (checkbox.checked){
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
					//removeHostFromListInSession('metadataFilterHosts', host);

					//check if host that will be removed has the "cohort" in the xena heatmap state setting ///////////TODO
					xenaQuery.all_cohorts(host).subscribe(function (s) {
						var xenaState = JSON.parse(sessionStorage.xena);
						if (xenaState.cohort && _.contains(s, xenaState.cohort)) { // reset xenaHeatmap
							xenaHeatmapStateReset();
						}
					});
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

	function updateHostDOM(host, status) {
		var display = {
				'live_selected': {msg: '', el: 'result'},
				'live_unselected': {msg: ' (running, not in your data hubs)', el: 'result2'},
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
				dom_helper.elt(display[status].el, dom_helper.hrefLink(shortLabel + display[status].msg,
					"../datapages/?host=" + host)), node);
		}
		if (sidebarNode && (status === "dead" || status === "slow")) {
			sidebarNode.parentNode.removeChild(sidebarNode);
			sidebarCheck.parentNode.removeChild(sidebarCheck);
		}
		if (sidebarNode && (status === "live_selected" || status === "live_unselected" || status === "nodata")){
				sidebarNode.parentNode.replaceChild(
					dom_helper.elt(display[status].el, dom_helper.hrefLink(shortLabel + display[status].msg,
						"../datapages/?host=" + host)), sidebarNode);
		}
		if (nodeHubPage) {
			nodeHubPage.parentNode.replaceChild(
				dom_helper.elt(displayHubPage[status].el, dom_helper.hrefLink(shortLabel + displayHubPage[status].msg,
					"../datapages/?host=" + host)), nodeHubPage);
		}
		if (nodeHubLabel && displayHubLabel[status]){
			if (displayHubLabel[status].color){
				nodeHubLabel.style.color = displayHubLabel[status].color;
				nodeHubCheck.style.background = "linear-gradient(" + displayHubLabel[status].color + ", white)";
			}
			if (displayHubLabel[status].msg) {
				nodeHubLabel.innerHTML = displayHubLabel[status].msg;
			}
		}
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

	return {
		sessionStorageInitialize: sessionStorageInitialize,
		updateHostStatus: updateHostStatus,
		hostCheckBox: hostCheckBox,
		metaDataFilterCheckBox: metaDataFilterCheckBox,
		xenaHeatmapSetCohort: xenaHeatmapSetCohort,
		getHubName: getHubName,
		datasetHasFloats: datasetHasFloats,
		setSessionStorage: ss => {sessionStorage = ss},

		GOODSTATUS: GOODSTATUS
	};
});
