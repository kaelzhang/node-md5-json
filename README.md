# md5-json [![NPM version](https://badge.fury.io/js/md5-json.svg)](http://badge.fury.io/js/md5-json) [![Build Status](https://travis-ci.org/kaelzhang/node-md5-json.svg?branch=master)](https://travis-ci.org/kaelzhang/node-md5-json) [![Dependency Status](https://gemnasium.com/kaelzhang/node-md5-json.svg)](https://gemnasium.com/kaelzhang/node-md5-json)

Creates md5.json to cache md5 hashes of all files. Designed for the situation of high concurrency.

## Installation

```bash
$ npm install md5-json --save
```

## Usage

```js
var md5json = require('md5-json');
```

### md5json.read(dir, [options]).get(file, callback)

- dir `path` absolute path of the root directory from where you want to read the md5sum of files
- file `path` absolute path of the file
- callback `function(err, md5sum)`
- err `Error`
- md5sum `String` the md5sum of the file
- options `Object=` not supported yet

```js
md5json
.read('/path/to/root')
.get('/path/to/the/file', function(err, md5){
  console.log(file, 'md5:', md5);
});
```

Reads the md5 hashes of any files based on the cache inside the `dir`. 

If the md5 hash is not in the cache, `md5json` will try to generate the md5 value from the file. If succeeded, the `md5sum` will passed to `callback` and `md5json` will save the cache silently without your concern.


### md5json.write(dir, callback)

- dir `path`
- callback `function(err)`

Writes the md5 hashes of all files inside the `dir` to the cache.

Notice that **NEVER** use this method in the situation of high concurrency, such live servers.
