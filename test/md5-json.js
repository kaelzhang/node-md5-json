'use strict';

var expect = require('chai').expect;
var md5json = require('../');
var node_path = require('path');
var jf = require('jsonfile');
var fs = require('fs');

var fixtures = node_path.join(__dirname, 'fixtures');

describe("md5.write", function(){
  it("normal case", function(done){
    var dir = node_path.join(fixtures, 'normal');
    md5json.write({
      dir: dir
    }, function (err) {
      var md5_file = node_path.join(dir, '.md5.json');
      jf.readFile(md5_file, function (err, json) {
        expect(err).to.equal(null);
        Object.keys(json).forEach(function (relative) {
          var file = node_path.join(dir, relative);
          var exists = fs.existsSync(file);
          expect(exists).to.equal(true);
        });
        done();
      });
    });
  });
});
