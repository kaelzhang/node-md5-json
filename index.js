'use strict';

var md5json = exports;
md5.write = write;
md5.read = read;
md5.Reader = Reader;

var crypto = require('crypto');
var node_path = require('path');
var jsonfile = require('jsonfile');
var glob = require('glob');
var _ = require('underscore');
var async = require('async');
var fs = require('fs');
var util = require('util');
var events = require('events');


// Use dot file, so that most systems will treat it as an invisible file.
md5json.CACHE_FILE = '.md5.json';
md5._dirs = {};


var REGEX_FILE = /[^\/]$/;
// @param {path} dir absolute path
function write (dir, callback) {
  dir = node_path.resolve(dir);
  json_file = node_path.resolve(dir, md5json.CACHE_FILE);
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
  var instance = md5json._dirs(dir);

  if (!instance) {
    instance = 
    md5json._dirs(dir) =
      new Reader(dir, options || {});
  }

  return instance;
};


function Reader (dir, options) {
  this.dir = dir;
  this.file = node_path.join(this.dir, md5json.CACHE_FILE);
  this._options(options);
  this._getJSON();

  var debounced = _.debounce(this._save.bind(this), options.save_interval);
  this.on('_change', debounced);
}

util.inherits(Reader, events);


Reader.prototype._options = function(options) {
  this.options = options;
  options.save_interval = options.save_interval || 500;
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
  this.once('_ready', callback);
};


Reader.prototype._getJSON = function() {
  var self = this;
  jsonfile.readFile(this.file, function (err, json) {
    // if (err) {
    //   // fail silently
    // }

    self.data = json || {};
    self.ready = true;
    self.emit('_ready');
  });
};


Reader.prototype._get = function (path, callback) {
  var relative = node_path.relative(this.dir, path);
  if (this.data[relative]) {
    return callback(null, this.data[relative]);
  }

  var self = this;
  this._generateMD5(path, function (err, sum) {
    if (err) {
      return callback(err);
    }

    self.data[relative] = sum;
    self.emit('_change');
  });
};


Reader.prototype._save = function() {
  if (this.saving) {
    return;
  }

  var self = this;
  jsonfile.writeFile(this.file, JSON.stringify(this.data, null, 2), function (err) {
    self.saving = false;
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
