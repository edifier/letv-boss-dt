/**
 * Created by wangxin on 15/10/3.
 * return object: {js:{path:path,......},rjs:{},css:{},image:{}}
 * 目的就是排除重复命名的文件
 */

'use strict';
const {readdirSync, lstatSync} = require('fs');
const {resolve, extname} = require('path');
const {forEach, notEmpty} = require('./util.js');
const {warn} = require('./trace.js');

module.exports = function (opt = {}) {

    let rule = [];

    //fileNameCache:排重的缓存数组
    let that = {}, fileNameCache = {};

    /*
     * 对象赋值操作
     * 出现重复的文件名，给出提示
     */
    let fileManipulation = (fileName, baseDir, type) => {
        let r = type == 'rjs' ? 'js' : type;
        if (!that[type]) that[type] = {};
        if (!fileNameCache[r]) fileNameCache[r] = {};
        if (fileNameCache[r][fileName] && notEmpty(opt[type]) && opt[type].output.type === 'normal') {
            if (opt.tipMsg) {
                warn('duplicate file name : \n' + fileNameCache[r][fileName] + '\n' + baseDir);
                that.duplicateFile = true;
            }
        }
        fileNameCache[r][fileName] = baseDir;
        that[type][resolve(baseDir)] = baseDir;
    };

    /*
     * 遍历inputpath路径下所有文件
     * 查找要处理的文件,交给fileManipulation方法
     */
    function walk(fileDir, rule) {
        let files = readdirSync(fileDir);

        forEach(files, function (fileName) {
            let baseDir = fileDir + fileName, lstat = lstatSync(baseDir);
            if (lstat.isDirectory()) {
                if (fileName === 'js') {
                    forEach(readdirSync(baseDir), function (fileName) {
                        if (notEmpty(opt.rjs) && /^.+_rjs\.js$/.test(fileName) && rule.indexOf('rjs') != -1) {
                            fileManipulation(fileName, baseDir + '/' + fileName, 'rjs');
                        } else if (notEmpty(opt.js) && /^.+\.js$/.test(fileName) && rule.indexOf('js') != -1) {
                            !(/^.+_rjs\.js$/.test(fileName)) && fileManipulation(fileName, baseDir + '/' + fileName, 'js');
                        }
                    });
                } else if (fileName === 'rjs' && rule.indexOf('rjs') != -1) {
                    notEmpty(opt.rjs) && forEach(readdirSync(baseDir), function (fileName) {
                        if (/^.+\.js$/.test(fileName)) {
                            fileManipulation(fileName, baseDir + '/' + fileName, 'rjs');
                        }
                    });
                } else if (fileName === 'css' && rule.indexOf('css') != -1) {
                    notEmpty(opt.css) && forEach(readdirSync(baseDir), function (fileName) {
                        if (/^.+\.css$/.test(fileName)) {
                            fileManipulation(fileName, baseDir + '/' + fileName, 'css');
                        }
                    });
                } else if (fileName === 'scss') {
                    notEmpty(opt.scss) && forEach(readdirSync(baseDir), function (fileName) {
                        if (/^.+\.scss$/.test(fileName)) {
                            fileManipulation(fileName, baseDir + '/' + fileName, 'scss');
                        }
                    });
                } else {
                    walk(baseDir + '/', rule);
                }
            } else if (lstat.isFile()) {
                if (/^.+_rjs\.js$/.test(fileName) && rule.indexOf('rjs') != -1) {
                    notEmpty(opt.rjs) && fileManipulation(fileName, baseDir, 'rjs');
                } else if (/^.+\.js$/.test(fileName) && rule.indexOf('js') != -1) {
                    notEmpty(opt.js) && !(/^.+_rjs\.js$/.test(fileName)) && fileManipulation(fileName, baseDir, 'js');
                } else if (/^.+\.css$/.test(fileName) && rule.indexOf('css') != -1) {
                    notEmpty(opt.css) && fileManipulation(fileName, baseDir, 'css');
                } else if (notEmpty(opt.image) && opt.image.patterns.indexOf(extname(fileName)) != -1 && rule.indexOf('image') != -1) {
                    fileManipulation(fileName, baseDir, 'image');
                }
            }
        });
    }

    for (let j in opt) {
        if (j === 'watch' || j === 'inputPath' || j === 'distrbute') continue;
        rule.push(j);
    }

    walk(opt.inputPath, rule);

    return that;
};