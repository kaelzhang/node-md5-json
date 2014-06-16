'use strict';

var md5json = exports;
md5json.write = write;
md5json.read = read;
md5json.Reader = Reader;

var crypto = require('crypto');
var node_path = require('path');
var jsonfile = require('jsonfile');
var glob = require('glob');
var _ = require('underscore');
var async = require('async');
var fs = require('fs');
var util = require('util');
var events = require('events').EventEmitter;


// Use dot file, so that most systems will treat it as an invisible file.
md5json.CACHE_FILE = '.md5.json';
md5json._dirs = {};
md5json.SAVE_INTERVAL = 500;


var REGEX_FILE = /[^\/]$/;
// @param {path} dir absolute path
function write (dir, callback) {
  dir = node_path.resolve(dir);
  var json_file = node_path.resolve(dir, md5json.CACHE_FILE);
  var json_dir = node_path.dirname(json_file);

  glob('**', {
    cwd: dir,
    mark: true
  }, function (err, files) {
    if (err) {
      return callback(err);
    }

    files = files
    .filter(REGEX_FILE.test, REGEX_FILE);

    var obj = {};
    async.each(files, function (file, done) {
      file = node_path.join(dir, file);
      if (file === json_file) {
        return done(null);
      }

      md5json._generateMD5(file, function (err, sum) {
        if (err) {
          return done(err);
        }

        // NEVER save the absolute path of the file, 
        // or it will expose the file structure of your machine
        var relative = node_path.relative(json_dir, file);
        obj[relative] = sum;
        done(null);
      });

    }, function (err) {
      if (err) {
        return callback(err);
      }
      
      jsonfile.writeFile(json_file, obj, callback);
    });
  });
};


// @param {path} dir absolute path of the dir to read files from
function read (dir, options) {
  dir = node_path.resolve(dir);
  var instance = md5json._dirs[dir];

  if (!instance) {
    instance = 
    md5json._dirs[dir] =
      new Reader(dir, options || {});
  }

  return instance;
};


function Reader (dir, options) {
  this.dir = dir;
  this.file = node_path.join(this.dir, md5json.CACHE_FILE);
  this._options(options);
  this._queue = {};
  this._getJSON();

  // Set to zero for unlimited listeners
  this.setMaxListeners(0);

  if (!options.no_cache) {
    var debounced = _.debounce(this._save.bind(this), options.save_interval);
    this.on('_change', debounced);

    this.__generateMD5 = this._generateMD5;
  } else {
    this.__generateMD5 = this._generateMD5NoQueue;
  }
}

util.inherits(Reader, events);


Reader.prototype._options = function(options) {
  this.options = options;
  options.save_interval = options.save_interval || md5json.SAVE_INTERVAL;
  options.no_cache = 'no_cache' in options
    ? options.no_cache
    : md5json.NO_CACHE;
};


Reader.prototype.get = function(path, callback) {
  this._prepare(function () {
    this._get(path, callback);
  }.bind(this));
};


Reader.prototype._prepare = function(callback) {
  if (this.ready) {
    return callback();
  }

  this._queue.ready.push(callback);
};


Reader.prototype._getJSON = function() {
  this._queue.ready = [];
  var self = this;
  jsonfile.readFile(this.file, function (err, json) {
    // if (err) {
    //   // fail silently
    // }

    self.data = json || {};
    self.ready = true;
    self._queue.ready.forEach(function (callback) {
      callback();
    });
    self._queue.ready.length = 0;
  });
};


Reader.prototype._get = function (path, callback) {
  path = node_path.resolve(this.dir, path);
  var relative = node_path.relative(this.dir, path);
  if (this.data[relative]) {
    return callback(null, this.data[relative]);
  }

  var self = this;
  this.__generateMD5(path, relative, callback);
};


Reader.prototype._generateMD5NoQueue = function(path, relative, callback) {
  md5json._generateMD5(path, callback);
};


Reader.prototype._generateMD5 = function(path, relative, callback) {
  var event = '_md5:' + path;
  var self = this;

  // For 10000 concurrency.
  // Imitating EventEmitter instead of EE saves one third of the entire time
  // 3500ms -> 2000ms
  var listeners = this._queue[event] || (this._queue[event] = []);
  var listeners_count = listeners.length;

  // It costs a lot to generate the md5 hash from a file on hardware,
  // so just queue it.
  listeners.push(callback);

  if (listeners_count === 0) {
    md5json._generateMD5(path, function (err, sum) {
      if (err) {
        // if there is error, never emit '_change' event.
        return self._simpleEmit(event, err);
      }

      self.data[relative] = sum;
      self.emit('_change');
      self._simpleEmit(event, null, sum);
    });
  }
};


Reader.prototype._simpleEmit = function (event, a, b) {
  var listeners = this._queue[event];
  if (!listeners) {
    return;
  }

  // Saves 100ms to use `for` instead of `array.forEach`
  var i = 0;
  var len = listeners.length;

  for (; i < len; i ++){
    listeners[i](a, b);
  }
  listeners.length = 0;
};


Reader.prototype._save = function() {
  if (this.saving) {
    return;
  }
  this.saving = true;

  var self = this;
  jsonfile.writeFile(this.file, this.data, function (err) {
    self.saving = false;
    self.emit('saved');
  });
};


md5json._generateMD5 = function (file, callback) {
  var rs = fs.createReadStream(file);
  var md5sum = crypto.createHash('md5');

  var cb = _.once(callback);

  rs.on('data', function (data) {
    md5sum.update(data);
  });

  rs.on('error', cb);

  rs.on('end', function () {
    var sum = md5sum.digest('hex');
    cb(null, sum);
  });
};
