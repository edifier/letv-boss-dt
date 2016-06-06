#!/usr/bin/env node

'use strict';
var fs = require('fs');
var PATH = require('path');
var browserifyPlus = require('../index.js');
var trace = require('../lib/trace.js');
var util = require('../lib/util.js');

/*
 * 获取config.bsp.js文件路径
 * return object: {path:.../config.bsp.js}
 */
function getFilePath(filePath, file, that) {
    util.forEach.call(fs.readdirSync(filePath), function (fileName) {
        var baseDir = filePath + fileName;
        try {
            var lstat = fs.lstatSync(baseDir);
        } catch (e) {
            trace.error('Skip a file parsing error.');
            //process.exit(1);
            return;
        }
        if (lstat.isDirectory()) {
            if (PATH.basename(baseDir).replace(/\..+$/, '') == '') return;
            getFilePath(baseDir + PATH.sep, file, that);
        } else if (lstat.isFile() && fileName === file) {
            that.path = baseDir;
            return false;
        }
    });
    return that;
}

var args = process.argv[2] ? process.argv[2].replace(/^\-/, '') : '';

//获取包程序版本号
if (/(v|version)/i.test(args)) {
    return trace.log(require('../package.json').version);
}

if (args && /(u|upload)/i.test(args)) {
    return require('../lib/upload.js')(process.argv[3]);
}

//配置文件当做参数传值的校验
if (args && !/.+\.bsp\.js$/.test(args)) {
    return trace.warn('configuration file named *.bsp.js');
}

var fileMap = args ? {path: util.relative(process.cwd(), args)} : getFilePath(process.cwd() + PATH.sep, 'config.bsp.js', {});

if (fileMap && fileMap.path) {
    try {
        var config = require(fileMap.path), dirName = PATH.dirname(fileMap.path);
    } catch (e) {
        trace.error('configuration file parsing error');
        process.exit(1);
    }

    browserifyPlus(util.extendDeep(config, {}, dirName));
} else {
    return trace.error('no configuration file, please edit it');
}
