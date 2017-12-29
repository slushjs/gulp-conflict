/* jshint camelcase: false, strict: false */
/* global describe, beforeEach, afterEach, it */
var chai = require('chai'),
    should = chai.should(),
    inquirer = require('inquirer'),
    diff = require('diff'),
    Vinyl = require('vinyl'),
    path = require('path'),
    conflict = require('../.');

function fixture (file) {
  var filepath = path.join(__dirname, file);
  return new Vinyl({
    path: filepath,
    cwd: __dirname,
    base: path.join(__dirname, path.dirname(file)),
    contents: null
  });
}

describe('gulp-conflict', function () {
  var exitCalled = false,
      diffCalled = false,
      origExit = null,
      origDiff = null;

  beforeEach(function () {
    origExit = process.exit;
    process.exit = function () {
      exitCalled = true;
    };
    origDiff = diff.diffLines;
    diff.diffLines = function () {
      diffCalled = true;
      return [];
    };
  });

  afterEach(function () {
    process.exit = origExit;
    exitCalled = false;
    diff.diffLines = origDiff;
    diffCalled = false;
  });

  it('should keep conflicting file on `y) replace`', function (done) {
    var file = fixture(__filename);

    mockPrompt({
      replace: 'replace'
    });

    var stream = conflict(__dirname);

    stream.on('error', function(err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (file) {
      should.exist(file);
      file.relative.should.equal(path.basename(__filename));
      done();
    });

    stream.write(file);

    stream.end();
  });

  it('should skip conflicting file on `n) do not replace`', function (done) {
    var file = fixture(__filename);

    mockPrompt({
      replace: 'skip'
    });

    var stream = conflict(__dirname);

    stream.on('error', function(err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (file) {
      should.not.exist(file);
      done();
    });

    stream.on('end', function () {
      done();
    });

    stream.write(file);

    stream.end();
  });

  it('should keep all conflicting files on `a) replace this and all...`', function (done) {
    var files = [
      fixture(__filename),
      fixture('test.json')
    ];

    mockPrompt({
      replace: 'replaceAll'
    });

    var stream = conflict(__dirname),
        count = 0;

    stream.on('error', function(err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (file) {
      should.exist(file);
      count += 1;
    });

    stream.on('end', function () {
      count.should.equal(2);
      done();
    });

    files.forEach(function (file) {
      stream.write(file);
    });

    stream.end();
  });

  it('should skip all conflicting files on `s) skip this and all...`', function (done) {
    var files = [
      fixture(__filename),
      fixture('test.json')
    ];

    mockPrompt({
      replace: 'skipAll'
    });

    var stream = conflict(__dirname),
        count = 0;

    stream.on('error', function(err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (file) {
      should.not.exist(file);
      count += 1;
    });

    stream.on('end', function () {
      count.should.equal(0);
      done();
    });

    files.forEach(function (file) {
      stream.write(file);
    });

    stream.end();
  });

  it('should abort (exit process) on `x) abort`', function (done) {
    var file = fixture(__filename);

    mockPrompt({
      replace: 'end'
    });

    var stream = conflict(__dirname);

    stream.on('error', function(err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (file) {
      should.not.exist(file);
      done();
    });

    stream.on('end', function () {
      exitCalled.should.equal(true);
      done();
    });

    exitCalled.should.equal(false);

    stream.write(file);

    stream.end();
  });

  it('should show diff between old and new files on `d) show diff...`', function (done) {
    var file = fixture('test.json');

    mockPrompt([{replace: 'diff'}, {replace: 'replace'}]);

    var stream = conflict(__dirname);

    stream.on('error', function(err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (file) {
      should.exist(file);
      file.relative.should.equal('test.json');
      diffCalled.should.equal(true);
      done();
    });

    diffCalled.should.equal(false);

    stream.write(file);

    stream.end();
  });

  it('should not crash when folders exist in stream', function (done) {
    var dir = new Vinyl({
      path: __dirname,
      cwd: __dirname,
      base: __dirname,
      contents: null
    });

    mockPrompt([{replace: 'replace'}]);

    var stream = conflict(__dirname);

    stream.on('error', function(err) {
      should.exist(err);
      done(err);
    });

    stream.on('data', function (file) {
      should.exist(file);
      file.relative.should.equal('');
      done();
    });

    stream.write(dir);

    stream.end();
  });
});

/**
 * Mock inquirer prompt (snippet from [Yeoman generator helpers](https://github.com/yeoman/generator/blob/master/lib/test/helpers.js))
 *
 * Enhanced to support multiple different answers to the same question (useful if called recursively to avoid infinite loop)
 */
function mockPrompt (answers) {
  var origPrompt = inquirer.prompt;
  inquirer.prompt = function (prompts, done) {
    var answ;
    if (Array.isArray(answers)) {
      answ = answers.shift();
    } else {
      answ = answers;
    }

    if (!Array.isArray(prompts)) {
      prompts = [prompts];
    }

    prompts.forEach(function (prompt) {
      if (!(prompt.name in answ)) {
        answ[prompt.name] = prompt.default;
      }
    });
    done(answ);
  };
  inquirer.origPrompt = origPrompt;
}
