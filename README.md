# CommonJs Browser Wrap

Wrap common-js require statements to export as a *iife()* wrapped module.

Basically, it creates one *iffe()* that you may add a export of some kind to (however, you choose).  All are wrapped for use by a internal loader (local to the iife function). It is like a poor-man's [browsify](http://browserify.org/) but better much, much better for some use cases.


## Install

```bash
npm install --save-dev gulp-commonjs-browser-wrap
```

Or

```bash
yarn add --dev gulp-commonjs-browser-wrap
```

### Example use

```javascript

const gulp = require('gulp');
const concat = require('gulp-concat');

gulp.task('build', ()=>gulp.src(['.lib/*.js'])
    .pipe(concat('browser.js'))
    .pipe(commonjsBrowserWrap({
    	type:'moduleWrap',
    	main:['./lib/index.js']
    }))
    .pipe(gulp.dest('./build'))
);
```

In the example above we take all of the *js* files in the */lib* directory and wrap each module.  These modules are then concatenated together using gulp-concat; the whole thing is then wrapped in an *iife*. We tell the plugin to load */lib/index.js* module in the iife closure.  It is assumed that */lib/index.js* has some sort of browser detection to export everything, for example:

```javascript
try {
	if (window) window.myModule = exports;
} catch (err) {
	// Not in a browser do nothing
}
```

## Why not use browsify?

Browsify is awesome, this module is not meant to somehow better it.  In some circumstances you don't want a massive build process involving browsify.  You might not want a module loader in the browsers or complicated build for programmers wishing to use your module.

All of the above are often useful or necessary.  However, if you need a simple gulp process that plugs into your current build. If you have have a module with both front-end and back-end components and you want to export a standalone browser module (without, much export fluff) then this module is designed to fill that gap.

## Using a global loader

If your module wants to load some modules from a global commonjs loader then you can use the *includeGlobal* option.  If this is set then the global loader is used as a fallback when a locally wrapped version is not found.

```javascript

gulp.task('build', ()=>gulp.src(['.lib/*.js'])
    .pipe(concat('browser.js'))
    .pipe(commonjsBrowserWrap({
    	type:'moduleWrap',
    	main:['./lib/index.js'],
    	includeGlobal: true
    }))
    .pipe(gulp.dest('./build'))
);
```

## Inserting extra code

Extra code can be inserted before or after the moduleWrap by using the *insertAtTop* and *insertAtBottom* option.

```javascript

gulp.task('build', ()=>gulp.src(['.lib/*.js'])
    .pipe(concat('browser.js'))
    .pipe(commonjsBrowserWrap({
    	type:'moduleWrap',
    	main:['./lib/index.js'],
    	includeGlobal: true,
    	insertAtTop: 'require("babel-polyfill");'
    }))
    .pipe(gulp.dest('./build'))
);
```


## Automatically including requires

We've written a companion vinyl-adaptor, [Vinyl CommonJs Dependencies](https://github.com/Whitebolt/vinyl-commonjs-dependencies) that is compatible with gulp. It can pull all the dependencies of a main module into the gulp stream for processing.

## Beta status

This module is definitely **beta**.  It works well and does everything it says on the tin.  However, it is still in active development.  If you have PRs, we'd be delighted to look at them.
