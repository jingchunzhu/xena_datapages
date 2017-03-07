'use strict';

var _ = require('underscore');

var Rx = {
	Observable: require('rxjs/Observable').Observable,
	Subject: require('rxjs/Subject').Subject,
	Scheduler: Object.assign(
			require('rxjs/Scheduler').Scheduler,
			require('rxjs/scheduler/asap'),
			require('rxjs/scheduler/animationFrame')),
	Subscription: require('rxjs/Subscription').Subscription

};

function zipArray(obs) {
	return obs.length ? Rx.Observable.zip(...obs, (...arr) => arr) :
		Rx.Observable.of([], Rx.Scheduler.asap);
}

Rx.Observable.zipArray = (...obs) =>
	_.isArray(obs[0]) ? zipArray(obs[0]) : zipArray(obs);

require('rxjs/add/observable/zip');
require('rxjs/add/observable/dom/ajax');

module.exports = Rx;
