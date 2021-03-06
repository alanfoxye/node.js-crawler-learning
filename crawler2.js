/* 2017.3.15 Node.JS crawler by alanfoxye*/

var myRequest = require('request')
var myCheerio = require('cheerio')
var myURL = 'http://e.icis-china.com/news/detail?id=1160&typeid=15'

//request module fetching url
function request(url, callback) {
    var options = {
        url: url,
        encoding: null,        
        //proxy: 'http://x.x.x.x:8080',
        headers: null
    }
    myRequest(options, callback)
}


request(myURL, function (err, res, body) {
    var html = body;
    
    var $ = myCheerio.load(html, { decodeEntities: false });
    //console.log($.html());
    
    console.log("encoding: " + $('meta').attr("charset"));
    console.log("keywords: " + $('meta[name="keywords"]').eq(1).attr("content"));
    console.log("title: " + $('title').text());
    console.log("date: " + $('span[class="date"]').eq(0).text());
    console.log("browse: " + $('span[class="date"]').eq(1).text());
    console.log("author: " + $('.editor>p').eq(0).text());
    console.log("content: " + $('.editor').text());

    //console.log($('.editor').html())
})