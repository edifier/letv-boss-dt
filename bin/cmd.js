#!/usr/bin/env node

'use strict';
const fs = require('fs');
const PATH = require('path');
const browserifyPlus = require('../index.js');
const trace = require('../lib/trace.js');
const util = require('../lib/util.js');

/*
 * 获取config.bsp.js文件路径
 * return object: {path:.../config.bsp.js}
 */
const getFilePath = (filePath = '', file = '', that = {}) => {
    util.forEach(fs.readdirSync(filePath), (fileName = '') => {
        let baseDir = filePath + fileName;
        try {
            let lstat = fs.lstatSync(baseDir);

            if (lstat.isDirectory()) {
                if (PATH.basename(baseDir).replace(/\..+$/, '') == '') return;
                getFilePath(baseDir + PATH.sep, file, that);
            } else if (lstat.isFile() && fileName === file) {
                that.path = baseDir;
            }
        } catch (e) {
            trace.error('Skip a file parsing error.');
            process.exit(1);
        }
    });
    return that;
};

const args = process.argv[2] ? process.argv[2].replace(/^\-/, '') : '';

//获取包程序版本号
if (/(v|version)/i.test(args)) {
    trace.log(require('../package.json').version);
    process.exit(0);
}

//ftp上传功能
if (args && /(u|upload)/i.test(args)) {
    require('../lib/upload.js')(process.argv[3]);
    process.exit(0);
}

//配置文件当做参数传值的校验
if (args && !/.+\.bsp\.js$/.test(args)) {
    trace.warn('configuration file named *.bsp.js');
    process.exit(0);
}

const fileMap = args ? {path: util.relative(process.cwd(), args)} : getFilePath(process.cwd() + PATH.sep, 'config.bsp.js', {});

if (fileMap && fileMap.path) {
    try {
        browserifyPlus(util.extendDeep(require(fileMap.path), {}, PATH.dirname(fileMap.path)));
    } catch (e) {
        console.log(e);
        trace.error('configuration file parsing error');
        process.exit(1);
    }
} else {
    trace.error('no configuration file, please edit it');
    process.exit(0);
}
