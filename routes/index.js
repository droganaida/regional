
module.exports = function(app){

//=====================================================//
//************ Client ************//
//=====================================================//

    var mainRoute = require('./client/main');
    app.get('/', mainRoute.get);

};