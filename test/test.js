/**
 * Created by wangxin8 on 2015/10/8.
 * 测试文件，终端：npm test
 */

'use strict';
var browserifyPlus = require('../index.js');

var config = {
    //需要编译的文件夹
    inputPath: './test/src',
    js: {
        output: {
            //输出banner
            banner: '/*build at <%time%>*/\n',
            //输出文件路径
            path: './js',
            //输出方式: normal、deep
            type: 'normal',
            //是否压缩
            compress: true
        }
    },
    rjs: {
        output: {
            //输出banner
            banner: '/*build at <%time%>*/\n',
            //输出文件路径
            path: './js',
            //输出方式: normal、deep
            type: 'normal',
            //是否压缩
            compress: false
        },
        //引用的库文件路径
        libraryPath: './core',
        //debug模式
        debug: false
    },
    css: {
        output: {
            //输出banner
            banner: '/*build at <%time%>*/\n',
            //输出文件路径
            path: './css',
            //输出方式: normal、deep
            type: 'normal'
        }
    },
    scss: {
        output:{
            path : 'css/',
            type : 'normal',
            compress: true
        }
    },
    image: {
        output: {
            //输出文件路径
            path: './i'
        },
        patterns: ['.png', '.jpg', '.gif']
    },
    watch: {
        //watch轮询的时常，默认值1200
        interval: 800
    }
    //watch: false
};

browserifyPlus(config);