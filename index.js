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
}
util.inherits(Reader, events);


Reader.prototype.get = function(path, callback) {
  this._prepare
};


Reader.prototype._getJSON = function(callback) {
  jsonfile.readFile(this.path, function (err, json) {
    if (err) {
      return callback(err);
    }

    this.data = json;
    callback();
  });
};


Reader.prototype._get = function (path, callback) {
  var relative = node_path.relative(this.dir, path);
  var data = this.data;
  if (!this.data) {
    return null;
  }

  return this.data[path] || null;
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
