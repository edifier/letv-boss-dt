/**
 * Created by wangxin on 15/10/6.
 * 递归生成文件夹
 */

'use strict';
const {exists, fs_mkdir, existsSync, mkdirSync} = require('fs');
const {resolve, dirname} = require('path');

const mkdir = (dist, callback) => {
    dist = resolve(dist);
    exists(dist, function (exists) {
        if (!exists) {
            mkdir(dirname(dist), () => {
                fs_mkdir(dist, function (err) {
                    callback && callback(err);
                });
            });
        } else {
            callback && callback(null);
        }
    });
};

mkdir.sync = function (dist) {
    dist = resolve(dist);
    if (!existsSync(dist)) {
        mkdir.sync(dirname(dist));
        mkdirSync(dist);
    }
};

module.exports = mkdir;
