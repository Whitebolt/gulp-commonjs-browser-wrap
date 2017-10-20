'use strict';

const util = require('lodash-provider');
util.__require = require;

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
util.makeArray = function makeArray(value) {
	if (value === undefined) return [];
	if (value instanceof Set) return [...value];
	return util.castArray(value);
};

/**
 * Take a path and lop one level off it
 *
 * @param {string} path		Path to lop.
 * @returns {string}		new path.
 */
util.lopped = function lopped(path) {
	const parts = path.split('/');
	parts.pop();
	return parts;
};

/**
 * Insert function text into source code at given comment.
 *
 * @param {string} txt					Text to insert into..
 * @param {string} insertPoint			Text to insert at.
 * @param {Array.<Function>} ...funcs	Functions to get source of and insert.
 * @returns {string}					New text.
 */
util.insertFunctions = function insertFunctions(txt, insertPoint, ...funcs){
	return txt.replace(insertPoint, funcs.map(functionName=>functionName.toString()).join(''));
};


module.exports = util;
