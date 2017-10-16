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

function wrapVinyl(file, pre, post) {
	if (file.isStream()) {
		let prepended = false;
		file.contents = file.contents.pipe(through2(
			{decodeStrings:false, encoding:'utf8'},
			function(chunk, encoding, callback) {
				if (!prepended) {
					this.push(pre(true));
					prepended = true;
				}
				callback();
			}, function(done) {
				this.push(post(true));
				done();
			}
		));
	} else if (file.isBuffer()) {
		file.contents = new Buffer(pre()+file.contents.toString('utf8')+post());
	}
}

function prePost(prePost) {
	return (buffer=true)=>(buffer?new Buffer(prePost):prePost);
}

function pluginRequires(options, file, encoding, callback) {
	if (file.isStream() || file.isBuffer()) {
		const moduleId = './' + path.relative(file.cwd, file.path);
		wrapVinyl(file, prePost('require(function(require, module){'), prePost(`}, '${moduleId}');`));
	}
	return callback(null, file);
}

function pluginModule(options, file, encoding, callback) {
	if (file.isStream() || file.isBuffer()) {
		const requires = makeArray(options.main).map(main=>`require("${main}");`).join();
		wrapVinyl(
			file,
			prePost(`(function(){const _commonjsBrowserWrapModules = new Map();${exportedRequire}`),
			prePost(`${requires}})()`)
		);
	}
	return callback(null, file);
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