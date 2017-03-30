/**
 * Created by wangxin8 on 2015/10/8.
 * 文件的输出处理，包括rjs、js、css文件
 */
'use strict';

const fs = require('fs');
const PATH = require('path');

const UglifyJS = require('uglify-js');
const CleanCSS = require('clean-css');
const spawn = require('cross-spawn');

const mkdir = require('./mkdir.js');
const trace = require('./trace.js');

const outputHandle = (code, basePath, configure, type) => {

    let content = code,
        config = configure[type],
        ast, minText, printOut;

    //压缩处理
    if (type !== 'scss') {
        if (type === 'js' || type === 'rjs') {
            //代码压缩
            if (config.output && config.output.compress) {

                //优化，替换之前的压缩方式
                try {
                    ast = UglifyJS.parse(content);
                    ast.figure_out_scope({screw_ie8:false});
                    ast.compute_char_frequency();
                    ast.mangle_names();
                    //获取文件内容
                    minText = ast.print_to_string({keep_quoted_props:true});
                } catch (e) {
                    trace.error(PATH.basename(basePath) + ' error: ' + e.message);
                    return false;
                }
            } else {
                minText = content;
            }
        } else if (type === 'css') {
            if (config.output && config.output.compress) {
                let cssObj = new CleanCSS({
                    relativeTo: PATH.dirname(basePath),
                    report: 'min'
                }).minify(content);

                if (cssObj.errors && cssObj.errors.length) trace.warn('error: ' + cssObj.errors[0]);
                minText = cssObj.styles;
            } else {
                minText = content;
            }
        }

        if (config.output && config.output.banner) {
            printOut = config.output.banner.replace(/<%time%>/gi, new Date()) + minText;
        } else {
            printOut = minText;
        }

        minText = null;

        //开始文件输出
        let outputpath = PATH.normalize((config.output && config.output.path) || './' + type + '/');

        let fileName = PATH.basename(basePath).replace(/\.bsp/, '');

        if (config.output.type === 'normal') {
            mkdir.sync(outputpath);
            fs.writeFileSync(outputpath + fileName, printOut);
        } else if (config.output.type === 'deep') {
            let p = PATH.relative(outputpath, basePath).replace(/(\.+[\/\\])*/gi, '');
            let route = PATH.dirname(outputpath + p) + PATH.sep;
            mkdir.sync(route);
            fs.writeFileSync(route + fileName, printOut);
        }
    } else {
        let fn = PATH.basename(basePath, '.scss').replace(/\.bsp/, '') + '.css';

        let compressed = config.output && config.output.compress ? "compressed" : "nested";
        let path = (config.output && config.output.path) || './css/';
        let p = basePath.replace(/\\/gi, '/');

        //开始文件输出生成css
        mkdir.sync(path);
        spawn('sass', ['--style', compressed, p, path + fn], {stdio: 'inherit'}).on('error', function () {
            trace.error("please install sass!");
        }).on('close', function (code) {
        });
    }

    printOut = null;
};

module.exports = outputHandle;