/*global define: false */
'use strict';
define(['./rx', './underscore_ext'], function (Rx, _) {
	function expandArrays(v, k) {
		if (_.isArray(v)) {
			return _.zip(v, _.times(v.length, _.constant(k)));
		}
		return [[v, k]];
	}

	function encodeParam(v, k) {
		return k + "=" + encodeURIComponent(v);
	}

	function encodeObject(obj) {
		return _.map(_.flatmap(obj, expandArrays), _.apply(encodeParam)).join("&");
	}

	function update(host, files, flags) {
		files = _.isArray(files) ? files : [files];
		return {
			headers: {'Content-Type': 'application/x-www-form-urlencoded'},
			url: host + '/update/',
			body: encodeObject(_.extend({file: files}, flags)),
			method: 'POST',
			crossDomain: true
		};
	}

	return {
		load: function (host, files, always) {
			return Rx.Observable.ajax(update(host, files, always ? {always: true} : {}));
		},
		delete: function (host, files) {
			return Rx.Observable.ajax(update(host, files, {delete: true}));
		}
	};
});
