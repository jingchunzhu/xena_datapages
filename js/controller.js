/*global require: false, module: false */
'use strict';
var _ = require('./underscore_ext');

var controls = {
	servers: (state, servers) => _.assocIn(state, ['servers', 'user'], servers),
	// XXX The list of things to be zeroed when cohort changes must be kept in
	// sync with the heatmap code. Might be better to put it under a key so it
	// can be opaque in this instance.
	cohort: (state, cohort) => state.cohort === cohort ? state :
		_.assoc(state,
			   'cohort', cohort,
			   'samplesFrom', null,
			   'samples', null,
			   'columns', {},
			   'columnOrder', [],
			   'data', {},
			   'survival', null,
			   'datasets', null,
			   'km', null)
};

var identity = x => x;

module.exports = {
	action: (state, [tag, ...args]) => (controls[tag] || identity)(state, ...args),
	postAction: (serverBus, state, [tag, ...args]) => (controls[tag + '-post!'] || identity)(serverBus, state, ...args)
};
