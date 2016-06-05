/*globals define: false */

'use strict';
define(['underscore', 'ehmutable'], function(_, immutable) {

	// Concat array with following arguments
	/* Like _.find, but return the result of the predicate */
	function findValue(obj, predicate, context) {
		var result;
		_.any(obj, function (value, index, list) {
			result = predicate.call(context, value, index, list);
			return result;
		});
		return result;
	}

	_.mixin({
		findValue: findValue,
		flatmap: _.compose(_.partial(_.flatten, _, 1), _.map),
		...immutable
	});

	return _;
});
