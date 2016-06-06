/*
 * author wangxin
 * 不同颜色表示不同的提示文案
 */

'use strict';
var colors = require('colors');

module.exports = {
    log: function (msg) {
        //white
        console.log(msg.white);
    },
    ok: function (msg) {
        //green
        console.log(msg.green);
    },
    load: function (msg) {
        //magenta
        console.log(msg.magenta);
    },
    warn: function (msg) {
        //yellow
        console.log(msg.yellow);
    },
    error: function (msg) {
        //red
        console.log(msg.red);
    }
};

