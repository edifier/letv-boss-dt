/*
 * author wangxin
 * 不同颜色表示不同的提示文案
 */

'use strict';
const colors = require('colors');

module.exports = {
    log: (msg) => console.log(msg.white), //white
    ok: (msg) => console.log(msg.green),//green
    load: (msg) => console.log(msg.magenta),//magenta
    warn: (msg) => console.log(msg.yellow),//yellow
    error: (msg) => console.log(msg.red) //red
};

