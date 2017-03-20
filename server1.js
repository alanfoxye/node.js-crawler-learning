var express = require('express');
var mysql = require('./lib/mysql.js')

var app = express();

app.use(express.static('public'));

app.get('/index.htm', function (req, res) {
    res.sendFile(__dirname + "/" + "index.htm");
})

app.get('/process_get', function (req, res) {

    //// 输出 JSON 格式
    response = {};
   
    //sql字符串和参数，尽量使用参数方式不用字符串拼接方式
    var fetchSql = 'select url,source_name,source_encoding,title,keywords,author,publish_date,crawltime,content from fetches where source_name=? and publish_date=?';
    var fetchSql_Params = [req.query.source_name, req.query.publish_date];

    //执行sql
    mysql.query(fetchSql, fetchSql_Params, function (err, result, fields) {
        //console.log(err);
        //console.log('result:', result);
        response = result;

        console.log(response);

        res.end(JSON.stringify(response));
    });
   
})

var server = app.listen(8081, function () {

    var host = server.address().address
    var port = server.address().port

    console.log("应用实例，访问地址为 http://%s:%s", host, port)

})
