/* 2017.3.15 Node.JS crawler by alanfoxye*/

var myRequest = require('request')
var myCheerio = require('cheerio')
var myIconv = require('iconv-lite')
var myEncoding = "gb2312"
require('date-utils');
var myURL = 'http://www.hxchem.net/newsdetail167887.html'

//防止网站屏蔽我们的爬虫
var headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.65 Safari/537.36'
}


//request module fetching url
function request(url, callback) {
    var options = {
        url: url,
        encoding: null,
        //proxy: 'http://x.x.x.x:8080',
        headers: headers
    }
    myRequest(options, callback)
}


request(myURL, function (err, res, body) {
    var html = myIconv.decode(body, myEncoding);
    //console.log(html);
    var $ = myCheerio.load(html, { decodeEntities: true });
    console.log("encoding: " + myEncoding);
    console.log("keywords: " + $('meta[name="keywords"]').eq(1).attr("content"));
    console.log("title: " + $('.hq_contet>dt').text());
    console.log("date: " + $('.hq_date').text());
    //console.log("browse: null");
    console.log("author: 华夏化工网");
    console.log("content: " + $('.hq_contet>dd').eq(1).text());
    console.log("crawltime: " + new Date().toFormat("YYYY-MM-DD HH24:MI:SS"));
    //console.log($('.editor').html())
})