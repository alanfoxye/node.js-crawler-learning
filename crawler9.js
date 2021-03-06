﻿/* 2017.3.22 Node.JS crawler by alanfoxye*/

//把所有的source相关字符串和jquery格式化字符串集中，准备后期用数据库进行配置，注意用\"转义字符串中的"，修改本部分
var source_name = "中国新闻网首页";
var source_id = 17;  
var domain = 'http://www.chinanews.com/'
var myEncoding = "gb2312"   //坑爹的网站，网站代码里写utf-8，实际却是gb2312
var seedURLs = ['http://www.chinanews.com/'];

var seedURL_format = "$('a')";
var keywords_format = " $('meta[name=\"keywords\"]').eq(0).attr(\"content\")";  //没有keywords就用source_name代替 //！！！
var title_format = "$('title').text()";
var date_format = "$('#BaiduSpider>#pubtime_baidu').text()"; //"$('.box01>.fl,.page_c>.fr,.p2j_text>h2').text()";
var author_format = "$('#BaiduSpider>#source_baidu').text()"; //+'#'+$('#BaiduSpider>#author_baidu').text()"; //"$('.box01>.fl,.page_c>.fr,.p2j_text>h2').text()";
var content_format = "$('.left_zw').find('p').text()";
var url_reg = /\/(\d{4})\/(\d{2})-(\d{2})\/(\d{7}).shtml/;


//以下是不变部分
var myRequest = require('request')
var myCheerio = require('cheerio')
var myIconv = require('iconv-lite')
require('date-utils');
var fs = require('fs');
var mysql = require('./lib/mysql.js')
var schedule = require('node-schedule')  //！
var es = require('./elasticsearch')
var regExp = /((\d{4}|\d{2})(\-|\/|\.)\d{1,2}\3\d{1,2})|(\d{4}年\d{1,2}月\d{1,2}日)/

//防止网站屏蔽我们的爬虫
var headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.65 Safari/537.36'
}

//request模块异步fetch url
function request(url, callback) {
    var options = {
        url: url,
        encoding: null,
        //proxy: 'http://x.x.x.x:8080',
        headers: headers,
        timeout: 10000  //
    }
    myRequest(options, callback)
}

//！定时执行
var rule = new schedule.RecurrenceRule();
//var times = [source_id % 12, 12 + source_id % 12];  //每天2次自动执行
var times = source_id % 24;  //每天1次自动执行
var times2=source_id%60;     //定义在第几分钟执行
rule.hour = times;
rule.minute = times2;

//定时执行httpGet()函数
schedule.scheduleJob(rule, function () {
httpGet();
});


//遍历所有seedURLs
function httpGet() {
    seedURLs.forEach(function (myseedURL, index) {
        setTimeout(function () {  //延迟爬取
            console.log(myseedURL);

            //爬取seedURL    
            request(myseedURL, function (err, res, body) {
                if (err) {
                    //读不到种子页面就跳到下一个种子页面
                    console.log(err);
                } else {
                    try {
                        //用iconv转换编码
                        var html = myIconv.decode(body, myEncoding);
                        //console.log(html);

                        //准备用cheerio解析html
                        var $ = myCheerio.load(html, { decodeEntities: true });
                    }
                    catch (e) {
                        console.log('读种子页面并转码出错：' + e);
                    }

                    //从seedURL页面获取所有新闻的url列表所处的html块

                    var seedurl_news;

                    try {
                        seedurl_news = eval(seedURL_format);
                        //console.log(seedurl_news);
                    }
                    catch (e) { console.log('url列表所处的html块识别出错：' + e) }

                    seedurl_news.each(function (i, e) {

                        var myURL = "";
                        try {
                            //得到具体新闻url
                            var href = "";
                            href = $(e).attr("href");
                            if (href.toLowerCase().indexOf('http://') >= 0) myURL = href;
                            else myURL = domain + href  //http://domain//*.html 有两个//也是合法的url
                        }
                        catch (e) { console.log('识别种子页面中的新闻链接出错：' + e) }

                        console.log(myURL);

                        if (url_reg != "") if (!(url_reg.test(myURL))) myURL = "";
                        //console.log(e);


                        //获取具体新闻页，注意node.js的异步模式，不保证seedurl或新闻url的执行次序！
                        if (myURL != "") {


                            var fetch_url_Sql = 'select url from fetches where url=?';
                            var fetch_url_Sql_Params = [myURL];

                            //执行sql，数据库中fetch表里的url属性是unique的，查询是否已有重复的url
                            mysql.query(fetch_url_Sql, fetch_url_Sql_Params, function (qerr, vals, fields) {
                                if (vals.length > 0) {
                                    console.log('URL duplicate!')
                                }
                                else {  //没有重复的URL
                                    setTimeout(function () {  //延迟爬取
                                        request(myURL, function (err, res, body) {
                                            if (err) {
                                                //读不到新闻页面就跳到下一个新闻页面
                                                console.log(err);
                                            }
                                            else {
                                                //用iconv转换编码
                                                try {
                                                    var html_news = myIconv.decode(body, myEncoding);
                                                    //console.log(html_news);

                                                    //准备用cheerio解析html_news
                                                    var $ = myCheerio.load(html_news, { decodeEntities: true });
                                                }
                                                catch (e) {
                                                    console.log('读新闻页面并转码出错：' + e);
                                                }
                                                console.log("转码读取成功:" + myURL);
                                                //动态执行format字符串，构建json对象准备写入文件或数据库
                                                var fetch = {};
                                                fetch.title = "";
                                                fetch.content = "";
                                                fetch.publish_date = (new Date()).toFormat("YYYY-MM-DD");

                                                try {
                                                    if (keywords_format == "") fetch.keywords = source_name; // eval(keywords_format);  //没有关键词就用sourcename
                                                    else fetch.keywords = eval(keywords_format);
                                                }
                                                catch (e) {
                                                    console.log('关键词识别出错：' + e)
                                                    fetch.keywords = source_name;
                                                }

                                                try {
                                                    if (title_format == "") fetch.title = ""
                                                    else fetch.title = eval(title_format);  //标题
                                                }
                                                catch (e) {
                                                    console.log('标题识别出错：' + e)
                                                    fetch.title = ""
                                                }

                                                try {
                                                    if (date_format != "") fetch.publish_date = eval(date_format);    //刊登日期   
                                                    console.log('date: ' + fetch.publish_date);
                                                    fetch.publish_date = regExp.exec(fetch.publish_date)[0];
                                                    fetch.publish_date = fetch.publish_date.replace('年', '-')
                                                    fetch.publish_date = fetch.publish_date.replace('月', '-')
                                                    fetch.publish_date = fetch.publish_date.replace('日', '')
                                                    fetch.publish_date = new Date(fetch.publish_date).toFormat("YYYY-MM-DD");
                                                }
                                                catch (e) {
                                                    fetch.publish_date = (new Date()).toFormat("YYYY-MM-DD");
                                                    console.log('刊登日期识别出错：' + e)
                                                }

                                                try {
                                                    if (author_format == "") fetch.author = source_name; //eval(author_format);  //作者
                                                    else fetch.author = eval(author_format);
                                                }
                                                catch (e) {
                                                    console.log('作者识别出错：' + e)
                                                    fetch.author = source_name
                                                }

                                                try {
                                                    if (content_format == "") fetch.content = "";
                                                    else fetch.content = eval(content_format).replace("\r\n" + fetch.author, "");  //内容,是否要去掉作者信息自行决定
                                                    //fetch.author = fetch.author.replace("作者：", "");   //作者格式修改，去掉前面的"作者："
                                                }
                                                catch (e) {
                                                    console.log('内容识别出错：' + e)
                                                    fetch.content = ""
                                                }

                                                //如果内容和标题不同时为空，就写入数据库和es
                                                if ((fetch.content == "") || (fetch.title == "")) {
                                                    console.log('内容为空或标题为空！')
                                                }
                                                else {
                                                    fetch.url = myURL;
                                                    fetch.source_name = source_name;
                                                    fetch.source_encoding = myEncoding;  //编码
                                                    //fetch.crawltime = (new Date()).toFormat("YYYY-MM-DD HH24:MI:SS");  //爬取时间
                                                    fetch.crawltime = new Date();  //爬取时间,写es的时候和写mysql的时候要求格式不同

                                                    //console.log(JSON.stringify(fetch));

                                                    ////构建存储json的文件名
                                                    //var filename = source_name + "_" + index + "_" + i + "_" + (new Date()).toFormat("YYYY-MM-DD") + ".json";
                                                    ////存储json
                                                    //fs.writeFileSync(filename, JSON.stringify(fetch));

                                                    //sql insert字符串和参数，尽量使用参数方式不用字符串拼接方式
                                                    var fetchAddSql = 'INSERT INTO fetches(url,source_name,source_encoding,title,keywords,author,publish_date,crawltime,content) VALUES(?,?,?,?,?,?,?,?,?)';
                                                    var fetchAddSql_Params = [fetch.url, fetch.source_name, fetch.source_encoding, fetch.title, fetch.keywords, fetch.author, fetch.publish_date, fetch.crawltime.toFormat("YYYY-MM-DD HH24:MI:SS"), fetch.content];

                                                    //执行sql，数据库中fetch表里的url属性是unique的，不把重复的url内容写入数据库
                                                    mysql.query(fetchAddSql, fetchAddSql_Params, function (qerr, vals, fields) {
                                                        if (qerr) {
                                                            //console.log(qerr);
                                                        }
                                                        else {
                                                            es.indexDocument(fetch);  //如果数据库写入没有异常(url重复会导致异常)，那么也同时写入es
                                                        }
                                                        //console.log('INSERT ID:', vals);
                                                    }); //mysql写入
                                                }  //如果内容和标题不同时为空，就写入数据库和es
                                            } //request新闻页成功，读不到新闻页面就跳到下一个新闻页面
                                        }) //request newspage
                                    }, 5000 * (i + 1) * (index + 1)); //newspage fetch timeout 
                                }   //没有重复的url        
                            }) //查询是否已有重复的url                                                       
                        }  // if (myURL != "")           
                    })  //newspage loop 
                } //request seedpage没有出现错误
            })  //request seedpage
        }, 3000 * (index + 1)); //seedpage fetch timeout
    })  //seedpage loop
}  //httpGet() func