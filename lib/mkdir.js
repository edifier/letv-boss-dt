/**
 * Created by wangxin on 15/10/6.
 * 递归生成文件夹
 */

'use strict';
const fs = require('fs');
const PATH = require('path');

let mkdir = (dist, callback) => {
    dist = PATH.resolve(dist);
    fs.exists(dist, function (exists) {
        if (!exists) {
            mkdir(PATH.dirname(dist), () => {
                fs.mkdir(dist, function (err) {
                    callback && callback(err);
                });
            });
        } else {
            callback && callback(null);
        }
    });
};

mkdir.sync = function (dist) {
    dist = PATH.resolve(dist);
    if (!fs.existsSync(dist)) {
        mkdir.sync(PATH.dirname(dist));
        fs.mkdirSync(dist);
    }
};

module.exports = mkdir;
