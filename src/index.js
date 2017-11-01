'use strict';

const through = require('through2');
const path = require('path');
const {makeArray, isFunction, isString, lopped, insertFunctions} = require('./util');
const xIsJson = /\.json$/;

const exportedRequire = insertFunctions(
	_require.toString().replace(/\b_require\b/g, 'require'),
	'// insert-functions',
	isFunction, isString, lopped, resolve
);

/**
 * Resolve a path to a given root.
 *
 * @param {path} to			Path to resolve to.
 * @param {path} from		Path to resolve from.
 * @returns {string}		Resolved path.
 */
function resolve(to, from) {
	if (from.charAt(0) !== '.') return from;
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

	if (path[0] === '.') resolved.unshift('.');

	return resolved.join('/');
}

/**
 * Call the given functions to insert text before and after file contents.
 *
 * @param {VinylFile} file		The vinyl-file we are dealing with.
 * @param {Function} pre		Pre function to get Buffer or text for preppending.
 * @param {Function} post		Post function to get Buffer or text for appending.
 */
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

/**
 * Create a pre/post function that returns the given text either as a Buffer or just text depending on
 * boolean parameter.
 *
 * @param {string} prePost		Text for pre/post function
 * @returns {Function}			Pre/Post function.
 */
function prePost(prePost) {
	/**
	 * @param {booleam} [buffer=true]		Whether to serve a Buffer or just plain text.
	 */
	return (buffer=true)=>(buffer?new Buffer(prePost):prePost);
}

/**
 * Pipe function for wrapping a module.
 *
 * @param {Object} options		The current plugin options.
 * @param {VinylFile} file		The vinyl-file we are dealing with.
 * @param {string} encoding		The file encoding.
 * @param {function} callback	Pipe callback to fire.
 */
function pluginRequires(options, file, encoding, callback) {
	if (file.isStream() || file.isBuffer()) {
		const moduleId = './' + path.relative(file.cwd, file.path);
		let pre = 'require(function(require, module){';
		let post = `}, '${moduleId}');`;
		if (xIsJson.test(file.path)) pre += 'module.exports=';
		wrapVinyl(file, prePost(pre), prePost(post));
	}
	return callback(null, file);
}

/**
 * Pipe function for wrapping an entire module (ie. the root module).
 *
 * @param {Object} options		The current plugin options.
 * @param {VinylFile} file		The vinyl-file we are dealing with.
 * @param {string} encoding		The file encoding.
 * @param {function} callback	Pipe callback to fire.
 */
function pluginModule(options, file, encoding, callback) {
	if (file.isStream() || file.isBuffer()) {
		const requires = makeArray(options.main).map(main=>{
			const moduleId = './' + path.relative(file.cwd, main);
			return `require('${moduleId}');`;
		}).join('');

		const topWrap = options.includeGlobal ?
			'__require, __module' :
			'';
		const bottomWrap = options.includeGlobal ? `
			(function(){try {return require;} catch(err) {}})(),
			(function(){try {return module;} catch(err) {}})()`
			: '';
		const bottomExtra = options.includeGlobal ?
			'require.cache = __require.cache;require.resolve = __require.resolve' :
			'';
		const pre = `(function(${topWrap}){
			const __commonjsBrowserWrap = {
				cache: Object.create(null),
				modules: Object.create(null),
				debug: ${!!options.debug}
			};
			${options.insertAtTop}
			${exportedRequire}
			${bottomExtra}
		`;

		const post = `
			${requires}
			${options.insertAtBottom}
		})(${bottomWrap})`;

		wrapVinyl(file, prePost(pre), prePost(post));
	}
	return callback(null, file);
}

function _require(moduleFunction, moduleId) {
	const _moduleId = moduleIdFix(moduleId);
	const module = {};
	const _globalCache = {};
	const globalCache = (()=>{
		try {
			return __require.cache;
		} catch(err) {
			return globalCache;
		}
	})();

	if (__module && __module.parent) module.parent = __module.parent;

	// insert-functions

	/**
	 * Add .js to end of module-id and ./ to beginning (where they are not present).
	 *
	 * @param {string} moduleId		Module id to fix
	 * @returns {string}			Fixed module id.
	 */
	function moduleIdFix(moduleId) {
		return ((!isFunction(moduleFunction))?moduleFunction:moduleId).replace(/\.js$/, '');
	}

	function debugMessage(message) {
		console.log(`CommonJs Wrap [DEBUG]: ${message}`);
	}

	function getAnchorRef(moduleId) {
		try {
			if (__filename) return __filename + '#' + moduleId;
		} catch (err) {}
	}

	const cache = {
		get: function(property, secondPass, originalProperty) {
			if (globalCache !== _globalCache) {
				if (globalCache.has && globalCache.has(property) && globalCache.get) return globalCache.get(property);
				if (property in globalCache) return globalCache[property];
				if (!secondPass) return cache.get(getAnchorRef(property), true, property);
			}
			return __commonjsBrowserWrap.cache[originalProperty || property];
		},
		set: function(property, value) {
			if (globalCache !== _globalCache) {
				var globalProperty = getAnchorRef(property);
				if (globalCache.set) return globalCache.set(globalProperty, value);
				globalCache[globalProperty] = value;
				return true;
			}
			return __commonjsBrowserWrap.cache[property] = value;
		},
		has: function(property, secondPass, originalProperty){
			if (globalCache !== _globalCache) {
				if (globalCache.has && globalCache.has(property)) return true;
				if (property in globalCache) return true;
				if (!secondPass) return cache.get(getAnchorRef(property), true, property);
			}
			return ((originalProperty || property) in __commonjsBrowserWrap.cache);
		}
	};

	/**
	 * Get a require function scoped to module.
	 *
	 * @returns {Function}		Scoped require.
	 */
	function getLocalRequire() {
		const localRequire = (localModuleId, ...params)=>_require(
			isString(_moduleId)?resolve(_moduleId, localModuleId):localModuleId,
			...params
		);
		try {
			localRequire.resolve = __require.resolve;
		} catch(err) {
			if (__commonjsBrowserWrap.debug) console.error(err);
			console.error(err);
		}
		return localRequire;
	}

	if (isFunction(moduleFunction)) return __commonjsBrowserWrap.modules[_moduleId] = moduleFunction;
	if (!(_moduleId in __commonjsBrowserWrap.modules)) {
		try {
			return __require(_moduleId);
		} catch (err) {
			if (__commonjsBrowserWrap.debug) console.error(err);
			console.error(err);
		}
		throw new SyntaxError(`Cannot find module with id: ${_moduleId}`);
	}

	if (cache.has(_moduleId)) return cache.get(_moduleId);
	__commonjsBrowserWrap.modules[_moduleId](getLocalRequire(_moduleId), module);
	cache.set(_moduleId, module.exports);

	return module.exports;
}

/**
 * Parse the module options adding defaults.
 *
 * @param {object} options			Options object.
 * @returns {Object}				Mutated options (defaults added).
 */
function parseOptions(options={}) {
	return Object.assign({
		type: 'requireWrap',
		includeGlobal: false,
		insertAtTop: '',
		insertAtBottom: '',
		debug: false
	}, options);
}

module.exports = options=>{
	const _options = parseOptions(options);
	return through.obj(function (...params){
		if (_options.type === 'requireWrap') {
			pluginRequires.bind(this)(_options, ...params);
		} else if (_options.type === 'moduleWrap') {
			pluginModule.bind(this)(_options, ...params);
		}
	});
};