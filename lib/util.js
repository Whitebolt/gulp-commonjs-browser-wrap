'use strict';

const {readFileSync} = require('fs');

/**
 * Turn the given value into an array.  If it is already an array then return it; if it is a set then convert to an
 * array; and if neither then return as the first item in an array. The purpose of this function is for function
 * or method parameters where they can be either a array or not.  You can use this to ensure you are working on
 * an array.
 *
 * @public
 * @param {Array|Set|*} value		Value to return or convert.
 * @returns {Array}					The converted value (or original if already an array).
 */
function makeArray(value) {
	if (value === undefined) return [];
	if (value instanceof Set) return [...value];
	return lodashRequire('castArray')(value);
}

/**
 * Get a lodash module id for the given function.
 *
 * @param {string} functionName		Lodash function to get module name of.
 * @returns {string}				Lodash module-id.
 */
function getLodashId(functionName) {
	return 'lodash.'+functionName.toLowerCase();
}

/**
 * Get the given function from lodash. Given a function name try to load the corresponding module.
 *
 * @throws {ReferenceError}			If function not found then throw error.
 * @param {string} functionName		The function name to find (this will be lower-cased).
 * @returns {Function}				The lodash function.
 */
function lodashRequire(functionName) {
	const moduleId = getLodashId(functionName);

	try {
		const method = require(moduleId);
		method.toString = lodashFunctionToString(functionName);
		return method;
	} catch (err) {
		throw new ReferenceError(`Could not find ${functionName}, did you forget to install ${moduleId}`);
	}
}

/**
 * Get the .toString() of a lodash function. Will wrap the entire module.
 *
 * @param {string} functionName		Function name to export.
 * @returns {Function}				The function module wrapped correctly.
 */
function lodashFunctionToString(functionName) {
	const moduleText = readFileSync(require.resolve(getLodashId(functionName)), 'utf-8');

	return function () {
		return 'function '+functionName+'() {const module = {exports:{}};'+moduleText+'\nreturn module.exports.apply({}, arguments);};';
	}
}


module.exports = new Proxy({
	makeArray
}, {
	get: function(target, property, receiver) {
		if (target.hasOwnProperty(property)) return Reflect.get(target, property, receiver);
		return lodashRequire(property);
	}
});
