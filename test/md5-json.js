'use strict';

var expect = require('chai').expect;
var md5json = require('../');
var node_path = require('path');
var jf = require('jsonfile');
var fs = require('fs-sync');
var tmp = require('tmp-sync');

var fixtures = node_path.join(__dirname, 'fixtures');
var DATA = jf.readFileSync( node_path.join(fixtures, 'md5.json') );

function play (include_md5) {
  var tmp_dir = tmp.in(fixtures);
  copy(fixtures, tmp_dir, 'a.js');
  copy(fixtures, tmp_dir, 'b.js');

  if (include_md5) {
    copy(fixtures, tmp_dir, 'md5.json', '.md5.json');
  }

  return tmp_dir;
}

function copy (from, to, file, to_file) {
  fs.copy( node_path.join(from, file), node_path.join(to, to_file || file) );
}


function test_result (dir, json) {
  Object.keys(json).forEach(function (relative) {
    var file = node_path.join(dir, relative);
    var exists = fs.exists(file);
    expect(exists).to.equal(true);   
  });
}


describe("md5json.write", function(){
  it("normal case", function(done){
    var dir = play();

    md5json.write(dir, function (err) {
      var md5_file = node_path.join(dir, '.md5.json');

      jf.readFile(md5_file, function (err, json) {
        expect(DATA).to.deep.equal(json);
        test_result(dir, json);
        done();
      });
    });
  });
});


describe("md5json.read", function(){
  it("should get the same instances", function(done){
    var dynamic = node_path.join(fixtures, 'dynamic');
    var ins = md5json.read(dynamic);
    var ins2 = md5json.read(dynamic);
    expect(ins).to.equal(ins2);
    done();
  });

  it("get(), without cache, with hight concurrency", function(done){
    this.timeout(20000);

    var dir = play();
    var a = node_path.join(dir, 'a.js');

    function cb (err, md5) {
      expect(md5).to.equal(DATA['a.js']);
      if (-- max === 0) {
        done();
      }
    }

    var reader = md5json.read(dir);
    var concurrency = 10000;
    var i = 0;
    var max = concurrency;
    while( i ++ < concurrency){
      reader.get(a, cb);
    }
  });
});
