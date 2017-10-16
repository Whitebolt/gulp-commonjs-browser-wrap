'use strict';

const through = require('through2');
const PluginError = require('gulp-util').PluginError;
const path = require('path');

const exportedRequire = _require.toString().replace(/_require/g, 'require');

function makeArray(value) {
	if (value === undefined) return [];
	if (value instanceof Set) return [...value];
	return (Array.isArray(value)?value:[value]);
}

function mains(options, file) {
	return makeArray(options.main).map(main=>path.resolve(file.cwd, main));
}

function pluginRequires(options, file, encoding, callback) {
	if (file.isNull()) return callback(null, file);

	if (file.isStream()) {
		this.emit('error', new PluginError(PLUGIN_NAME, 'Streams not supported!'));
	} else if (file.isBuffer()) {
		const contents = file.contents.toString('utf8');
		const moduleId = './' + path.relative(file.cwd, file.path);

		file.contents = new Buffer(`require(function(require, module){${contents}}, '${moduleId}');`);
		return callback(null, file);
	}
}

function pluginModule(options, file, encoding, callback) {

	if (file.isNull()) return callback(null, file);

	if (file.isStream()) {
		this.emit('error', new PluginError(PLUGIN_NAME, 'Streams not supported!'));
	} else if (file.isBuffer()) {
		const contents = file.contents.toString('utf8');
		const requires = makeArray(options.main).map(main=>`require("${main}");`).join();

		file.contents = new Buffer(`(function(){
			const _commonjsBrowserWrapModules = new Map();
			${exportedRequire}
			${contents}
			${requires}
		})()`);

		return callback(null, file);
	}
}

function _require(moduleFunction, moduleId) {
	const _moduleId = moduleIdFix(moduleId);
	const module = {};

	function isFunction(value) {
		return !!(value && value.constructor && value.call && value.apply);
	}

	function isString(value) {
		return ((typeof value === 'string') || (value instanceof String));
	}

	function lopped(path) {
		const parts = path.split('/');
		parts.pop();
		return parts;
	}

	function moduleIdFix(moduleId) {
		const _moduleId = ((!isFunction(moduleFunction))?moduleFunction:moduleId).replace(/\.js$/, '');
		return (((_moduleId.charAt(0) !== '/') && (_moduleId.charAt(0) !== '.')) ? './' + _moduleId : _moduleId);
	}

	function resolve(to, from) {
		const path = lopped(to).concat(from.split('/'));
		const resolved = [];
		let back = 0;
		for (let n=path.length-1; n>=0; n--) {
			if (path[n] !== '.') {
				if (path[n] === '..') {
					back++;
				} else if (back > 0) {
					back--;
				} else {
					resolved.unshift(path[n]);
				}
			}
		}

		return resolved.join('/');
	}

	function getLocalRequire() {
		return (localModuleId, ...params)=>_require(
			isString(_moduleId)?resolve(_moduleId, localModuleId):localModuleId,
			...params
		);
	}

	if (isFunction(moduleFunction)) return _commonjsBrowserWrapModules.set(_moduleId, moduleFunction);
	if (!_commonjsBrowserWrapModules.has(_moduleId)) throw new SyntaxError(`Cannot find module with id: ${moduleId}`);
	_commonjsBrowserWrapModules.get(_moduleId)(getLocalRequire(_moduleId), module);
	return module.exports;
}

module.exports = options=>{
	return through.obj(function (...params){
		if (!options || !options.type || (options.type === 'requireWrap')) {
			pluginRequires.bind(this)(options, ...params);
		} else if (options && (options.type === 'moduleWrap')) {
			pluginModule.bind(this)(options, ...params);
		}
	});
};