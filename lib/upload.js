/**
 * Created by wangxin8 on 2015/10/8.
 * 文件的ftp上传
 */
const {readFileSync, existsSync, readdirSync} = require('fs');
const {extname, basename} = require('path');
const {createInterface} = require('readline');

const Client = require('ssh2').Client;

const {error, ok, log, load}  = require('./trace.js');
const {relative, forEach} = require('./util.js');


const config = {
    cwd: 'diff.log',
    userInfo: {
        name: "root",
        password: "d7PGxcf3bhx9YoZJpGFm"
    },
    ftp: {
        host: '10.154.250.38',
        port: 22,
        basePath: '/data/static/pay/'
    }
};

const go = (files = [], i) => {

    let len = files.length;

    const upload = (localfile, remoteFile) => {
        let c = new Client();

        c.on('ready', function () {
            c.sftp(function (err, sftp) {
                if (err) throw err;
                sftp.fastPut(localfile.replace(/\\/g, '/'), remoteFile.replace(/\\/g, '/'), function (err) {
                    if (err) throw err;
                    c.end();
                    ok(localfile + ' :上传完成！');
                    go(files, ++i);
                });
            });
        });

        c.connect({
            host: config.ftp.host,
            port: config.ftp.port,
            username: config.userInfo.name,
            password: config.userInfo.password
        });
    };

    if (i < len) {
        let file = files[i],
            $extname = extname(file),
            dir = $extname == '.js' ? '/js/' : '/css/';
        upload(relative(process.cwd() + dir, file).replace(/\\/g, '/'), relative(config.ftp.basePath + dir, file).replace(/\\/g, '/'));
    } else {
        ok('全部文件上传完毕!\n');
        process.exit(0);
    }
};

module.exports = (type) => {

    let cwd, files = [];

    if (!type) {
        filePaths = readFileSync(relative(process.cwd(), config.cwd), 'utf-8').split('\n');

        forEach(filePaths, function (file) {
            if (file) {
                let path = relative(process.cwd(), '../' + file);
                existsSync(path) && files.push(basename(path));
            }
        });
    } else {
        if (type == 'js') {
            cwd = 'js/';
        } else if (type == 'css') {
            cwd = 'css/';
        }

        try {
            files = readdirSync(relative(process.cwd(), cwd));
        } catch (e) {
            error('上传任务需要输入一个路径');
            process.exit(1);
        }
    }

    if (files.length === 0) {
        log('没有需要上传的文件，进程结束');
        process.exit(1);
    }

    load('\n上线文件清单 : ');
    ok(files.join('\n'));
    log('\n');

    process.stdin.setEncoding('utf8');
    let rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('你确定上传以上文件吗？(Y/N)', (data) => {

        data = data.trim();
        rl.close();

        if (data == 'Y') {
            go(files, 0);
        } else {
            process.exit(0);
        }
    });
};