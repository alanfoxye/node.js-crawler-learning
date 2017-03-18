/* 2017.3.16 Node.JS crawler by alanfoxye*/

var myRequest = require('request')
var myCheerio = require('cheerio')
var myIconv = require('iconv-lite')
require('date-utils');
var fs = require('fs');
var mysql=require('./lib/mysql.js')
var schedule = require('node-schedule');  //！

//把所有的source相关字符串和jquery格式化字符串集中，准备后期用数据库进行配置，注意用\"转义字符串中的"

var source_name = "天天化工网";
var domain = 'http://pu.chem366.com/'
var myEncoding = "utf-8"
var seedURLs = ['http://pu.chem366.com/News/NewList2.aspx?action=putt', 'http://pu.chem366.com/News/HotNewsList_v2.aspx?htype=1&typeid=1001',
    'http://pu.chem366.com/News/HotNewsList_v2.aspx?htype=2&typeid=1001'];

var seedURL_format = "$('.newslist>li>a')";
var keywords_format = "$('meta[name=\"keywords\"]').eq(0).attr(\"content\")";  //没有keywords就用source_name代替
var title_format = "$('#newstitle>b').text()";
var date_format = "";  //文章来源：天天化工网独家发布&nbsp;添加时间：2017-03-16
var author_format = "$('#newsbg>div')eq(1).text()";  //文章来源：天天化工网独家发布&nbsp;添加时间：2017-03-16
var content_format = "$('#newscontext').text()";

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
        timeout: 5000  //增加5秒超时停止 ！
    }
    myRequest(options, callback)
}

//！定时执行
var rule = new schedule.RecurrenceRule();
var times = [10,22];  //每天10点和22点自动执行
rule.hour = times;
schedule.scheduleJob(rule, function () {
    httpGet();
});

//遍历所有seedURLs
function httpGet(){
    seedURLs.forEach(function (myseedURL, index) {
        //爬取seedURL    
        request(myseedURL, function (err, res, body) {

            try {
                //用iconv转换编码
                var html = myIconv.decode(body, myEncoding);
                //console.log(html);

                //准备用cheerio解析html
                var $ = myCheerio.load(html, { decodeEntities: true });
            }
            catch (e) {
                console.log(e);
            }
            

            //从seedURL页面获取所有新闻的url列表所处的html块

            var seedurl_news;

            try {
                seedurl_news = eval(seedURL_format);
            }
            catch (e) { console.log(e) }

            seedurl_news.each(function (i, e) {

                setTimeout(function () {  //！

                    var myURL = "";
                    try {
                        //得到具体新闻url
                        myURL = domain + $(e).attr("href");
                    }
                    catch (e) { console.log(e) }

                    console.log(myURL);
                    //console.log(e);

                    //获取具体新闻页，注意node.js的异步模式，不保证seedurl或新闻url的执行次序！
                    if (myURL != "") request(myURL, function (err, res, body) {
                        //用iconv转换编码
                        try {
                            var html_news = myIconv.decode(body, myEncoding);
                            //console.log(html_news);

                            //准备用cheerio解析html_news
                            var $ = myCheerio.load(html_news, { decodeEntities: true });
                        }
                        catch (e) {
                            console.log(e);
                        }

                        //动态执行format字符串，构建json对象准备写入文件或数据库
                        var fetch = {};
                        fetch.encoding = myEncoding;  //编码

                        try {
                            if (keywords_format == "") fetch.keywords = source_name; // eval(keywords_format);  //没有关键词就用sourcename
                            else fetch.keywords = eval(keywords_format);
                        }
                        catch (e) { console.log(e) }

                        try {
                            if (title_format == "") fetch.title = ""
                            else fetch.title = eval(title_format);  //标题
                        }
                        catch (e) { console.log(e) }

                        try {
                            if (date_format == "") fetch.date = myURL.split('/')[5];  //修改
                            else fetch.date = eval(date_format);    //刊登日期            
                        }
                        catch (e) { console.log(e) }

                        try {
                            if (author_format == "") fetch.author = source_name; //eval(author_format);  //作者
                            else fetch.author = eval(author_format);
                        }
                        catch (e) { console.log(e) }

                        try {
                            if (content_format == "") fetch.content = "";
                            else fetch.content = eval(content_format); //.replace("\r\n" + fetch.author, "");  //内容,是否要去掉作者信息自行决定
                            //fetch.author = fetch.author.replace("作者：", "");   //作者格式修改，去掉前面的"作者："
                        }
                        catch (e) { console.log(e) }

                        fetch.crawltime = (new Date()).toFormat("YYYY-MM-DD HH24:MI:SS");  //爬取时间
                        fetch.url = myURL;

                        //console.log(fetch);
                        ////构建存储json的文件名
                        //var filename = source_name + "_" + index + "_" + i + "_" + (new Date()).toFormat("YYYY-MM-DD") + ".json";
                        ////存储json
                        //fs.writeFileSync(filename, JSON.stringify(fetch));

                        //sql insert字符串和参数，尽量使用参数方式不用字符串拼接方式
                        var fetchAddSql = 'INSERT INTO fetches(url,source_name,source_encoding,title,keywords,author,publish_date,crawltime,content) VALUES(?,?,?,?,?,?,?,?,?)';
                        var fetchAddSql_Params = [fetch.url, source_name, myEncoding, fetch.title, fetch.keywords, fetch.author, fetch.date, fetch.crawltime, fetch.content];

                        //执行sql，数据库中fetch表里的url属性是unique的，不把重复的url内容写入数据库
                        mysql.query(fetchAddSql, fetchAddSql_Params, function (err, res, fields) {
                            console.log(err);
                            //console.log('INSERT ID:', res);
                        });       
                    })
                }, 3000*i); //！
            });
        })
    })
}