'use strict';
var through2 = require('through2'),
    inquirer = require('inquirer'),
    gutil = require('gulp-util'),
    diff = require('diff'),
    fs = require('fs'),
    path = require('path'),
    pkg = require('./package');

module.exports = function conflict (dest, opt) {
  if (!dest) {
    error('Missing destination dir parameter!');
  }

  opt = opt || {};

  var all = false;

  return through2.obj(function (file, enc, cb) {
    var newPath = path.resolve(opt.cwd || process.cwd(), dest, file.relative);
    fs.stat(newPath, function (err, stat) {
      if (!all && stat && !stat.isDirectory()) {
        fs.readFile(newPath, 'utf8', function (err, contents) {
          if (err) {
            error('Reading old file for comparison failed with: ' + err.message);
          }
          if (contents === String(file.contents)) {
            log('Skipping ' + file.relative + ' (identical)');
            return cb();
          }
          var askCb = function askCb (action) {
            switch (action) {
              case 'all':
                all = true;
                /* falls through */
              case 'replace':
                log('Keeping ' + file.relative);
                this.push(file);
                break;
              case 'skip':
                log('Skipping ' + file.relative);
                break;
              case 'end':
                log(gutil.colors.red('Aborting...'));
                process.exit(0);
                break;
              case 'diff':
                log('Showing diff for ' + file.relative);
                diffFiles(file, newPath);
                ask(file, askCb.bind(this));
                return;
            }
            cb();
          };
          ask(file, askCb.bind(this));
        }.bind(this));
      } else {
        log('Keeping ' + file.relative);
        this.push(file);
        cb();
      }
    }.bind(this));
  });
};

function ask (file, cb) {
  inquirer.prompt([{
    type: 'expand',
    name: 'replace',
    message: 'Replace ' + file.relative + '?',
    choices: [{
      key: 'y',
      name: 'replace',
      value: 'replace'
    }, {
      key: 'n',
      name: 'do not replace',
      value: 'skip'
    }, {
      key: 'a',
      name: 'replace this and all others',
      value: 'all'
    }, {
      key: 'x',
      name: 'abort',
      value: 'end'
    }, {
      key: 'd',
      name: 'show the differences between the old and the new',
      value: 'diff'
    }]
  }],
  function (answers) {
    cb(answers.replace);
  });
}

function diffFiles (newFile, oldFilePath) {
  if (newFile.isStream()) {
    error('Diff does not support file streams');
  }
  try {
    var content = fs.readFileSync(oldFilePath, 'utf8');
    var differences = diff.diffLines(content, String(newFile.contents));
    log('File differences: ' + gutil.colors.bgGreen('added') + ' ' + gutil.colors.bgRed('removed') + '\n\n' + differences.map(formatPart).join(''));
  } catch (err) {
    error('Reading old file for diff failed with: ' + err.message);
  }
}

function formatPart (part, i) {
  var indent = new Array(8).join(' ');
  return (!i ? indent : '') + part.value.split('\n').map(function (line) {
    return gutil.colors[colorFromPart(part)](line);
  }).join('\n' + indent);
}

function colorFromPart (part) {
  if (part.added) {
    return 'bgGreen';
  } else if (part.removed) {
    return 'bgRed';
  }
  return 'grey';
}

function log () {
  var logger = gutil.log.bind(gutil, '[' + gutil.colors.cyan('conflict') + ']');
  logger.apply(logger, arguments);
}

function error (message) {
  throw new gutil.PluginError(pkg.name, message);
}

