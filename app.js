var express = require('express');
var http = require('http');
var path = require('path');
var log = require('./libs/log')(module);
var bodyParser = require('body-parser');
var myconfig = require('./libs/myconfig');
var session = require('express-session');
var favicon = require('express-favicon');
var multer  = require('multer');
var compression = require('compression');
var common = require('./common');
var cluster = require('cluster');

var app = express();

app.use(favicon(__dirname + '/public/images/icons/favicon.ico'));

if (cluster.isMaster) {

    var cpuCount = require('os').cpus().length;

    for (var i = 0; i < cpuCount; i += 1) {
        cluster.schedulingPolicy = cluster.SCHED_NONE;
        cluster.fork();
    }

    cluster.on('exit', function (worker) {
        console.log('Worker ' + worker.id + ' died :(');
        cluster.fork();
    });

} else {

    app.use(compression());

    app.set('views', __dirname + '/templates');
    app.set('view engine', 'ejs');

    app.use(bodyParser.urlencoded({
        extended: true,
        limit: '50mb'
    }));

    app.use(multer(
        {
            dest: path.join(__dirname, 'public/uploads'),
            limits: {
                fieldNameSize: 999999999,
                fieldSize: 999999999
            },
            includeEmptyFields: true,
            inMemory: true,
            onParseEnd: function(req, next) {
                next();
            },
            onError: function(e, next) {
                if (e) {
                    log.error( '------------Error: ' + e.stack);
                }
                next();
            }
        }
    ).any());

    app.use(express.static(path.join(__dirname, 'public')));
    app.use('/files', express.static('../files'));

    var sessionStore = require('./libs/sessionStore');
    app.use(session({
        secret: myconfig.session.secret,
        key: myconfig.session.key,
        cookie: myconfig.session.cookie,
        store: sessionStore,
        saveUninitialized: true,
        resave: true
    }));

    app.use(common.commonMiddleware);

    require('./routes')(app);

    var gcInterval;
    function init()
    {
        gcInterval = setInterval(function() { gcDo(); }, 60000);
    }
    function gcDo()
    {
        global.gc();
        clearInterval(gcInterval);
        init();
    }
    init();

    app.use(function(req, res){

        res.locals.metatitle = 'Seite Nicht Gefunden';
        res.locals.pagenoindex = 'yes';
        res.status(404).render('./client/error/error');
    });

    var httpServer = http.createServer(app);

    function onListening(){
        log.info('Listening on port %d', myconfig.port);
    }

    httpServer.on('listening', onListening);
    httpServer.listen(myconfig.port, '127.0.0.1');


}

process.on('uncaughtException', function (err) {
    log.error((new Date).toUTCString() + ' uncaughtException:', err.message);
    log.error(err.stack);
    process.exit(1);
});