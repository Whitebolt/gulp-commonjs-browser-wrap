'use strict';

const through = require('through2');
const PluginError = require('gulp-util').PluginError;
const path = require('path');

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
		file.contents = new Buffer(`require(function(require, module){${contents}}, '${file.path}');`);
		return callback(null, file);
	}
}

function pluginModule(options, file, encoding, callback) {

	if (file.isNull()) return callback(null, file);

	if (file.isStream()) {
		this.emit('error', new PluginError(PLUGIN_NAME, 'Streams not supported!'));
	} else if (file.isBuffer()) {
		const require = _require.toString().replace(/_require/g, 'require');
		const contents = file.contents.toString('utf8');
		const requires = mains(options, file).map(main=>`require("${main}");`).join();

		file.contents = new Buffer(`(function(){
			const modules = new Map();
			${require}
			${contents}
			${requires}
		})()`);

		return callback(null, file);
	}
}

function _require(moduleFunction, moduleId) {
	function isFunction(value) {
		return !!(value && value.constructor && value.call && value.apply);
	}

	function lopped(path) {
		const parts = path.split('/');
		parts.pop();
		return parts;
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

	if (!isFunction(moduleFunction)) {
		moduleId = moduleFunction.replace(/\.js$/, '');

		const localRequire = function (localModuleId, ...params) {
			const resolvedModuleId = (isFunction(localModuleId)?localModuleId:resolve(moduleId, localModuleId));
			return _require(resolvedModuleId, ...params);
		};


		const module = {};
		modules.get(moduleId)(localRequire, module);
		return module.exports;
	} else {
		moduleId = moduleId.replace(/\.js$/, '');
		modules.set(moduleId, moduleFunction);
	}
}

module.exports = options=>{
	if (!options || !options.type || (options.type === 'requireWrap')) return through.obj(function (...params){
		pluginRequires.bind(this)(options, ...params);
	});
	if (options.type === 'moduleWrap') return through.obj(function (...params){
		pluginModule.bind(this)(options, ...params);
	});
};