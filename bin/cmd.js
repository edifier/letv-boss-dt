#!/usr/bin/env node

'use strict';
const {readdirSync, lstatSync} = require('fs');
const {basename, sep, dirname} = require('path');
const taskRun = require('../index.js');
const {error, log, warn} = require('../lib/trace.js');
const {forEach, relative, extendDeep} = require('../lib/util.js');

/*
 * 获取config.bsp.js文件路径
 * return object: {path:.../config.bsp.js}
 */
const getFilePath = (filePath = '', file = '', that = {}) => {
    forEach(readdirSync(filePath), (fileName = '') => {
        let baseDir = filePath + fileName;
        try {
            let lstat = lstatSync(baseDir);

            if (lstat.isDirectory()) {
                if (basename(baseDir).replace(/\..+$/, '') == '') return;
                getFilePath(baseDir + sep, file, that);
            } else if (lstat.isFile() && fileName === file) {
                that.path = baseDir;
            }
        } catch (e) {
            error('Skip a file parsing error.');
            process.exit(1);
        }
    });
    return that;
};

const args = process.argv[2] ? process.argv[2].replace(/^\-/, '') : '';

//获取包程序版本号
if (/(v|version)/i.test(args)) {
    log(require('../package.json').version);
    process.exit(0);
}

//ftp上传功能
if (args && /(u|upload)/i.test(args)) {
    require('../lib/upload.js')(process.argv[3]);
    return false;
}

//配置文件当做参数传值的校验
if (args && !/.+\.bsp\.js$/.test(args)) {
    warn('configuration file named *.bsp.js');
    process.exit(0);
}

const fileMap = args ? {path: relative(process.cwd(), args)} : getFilePath(process.cwd() + sep, 'config.bsp.js', {});

if (fileMap && fileMap.path) {
    try {
        taskRun(extendDeep(require(fileMap.path), {}, dirname(fileMap.path)));
    } catch (e) {
        error(String(e));
        error('\nconfiguration file parsing error');
        process.exit(1);
    }
} else {
    error('no configuration file, please edit it');
    process.exit(0);
}
