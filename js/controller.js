/*global require: false, module: false */
'use strict';
var _ = require('./underscore_ext');
var {defaultState} = require('./defaults');
var {updateHostStatus} = require('./session');

// After settings change, update the list of hosts that
// are in use for the session. It's confusing that 'hubs'
// tracks 'servers.userHosts', while viz tracks 'server.user'.
var setUserServers = state => {
	let {activeHosts, userHosts} = state.servers;
	return _.assocIn(state, ['servers', 'user'],
			_.intersection(activeHosts, userHosts));
};

function updateAllHosts(state) {
	state.allHosts.forEach(function(host) {
		updateHostStatus(host); // only currently update sessinostorage, not state ( :( )
	});
}

var controls = {
	init: state => _.updateIn(state, ['servers'], s => _.merge(defaultState, s)),
	'init-post!': (serverBus, state, newState) => updateAllHosts(newState),
	'add-host': (state, list, host) =>
		setUserServers(_.updateIn(state, ['servers', list], l => _.union(l, [host]))),
	'remove-host': (state, list, host) =>
		setUserServers(_.updateIn(state, ['servers', list], l => _.difference(l, [host]))),
	 cohort: (state, cohort) => _.assoc(state, 'cohortPending', [{name: cohort}])
};

var identity = x => x;

module.exports = {
	action: (state, [tag, ...args]) => (controls[tag] || identity)(state, ...args),
	postAction: (serverBus, state, [tag, ...args]) => (controls[tag + '-post!'] || identity)(serverBus, state, ...args)
};
