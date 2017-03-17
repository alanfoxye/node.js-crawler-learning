/* 2017.3.16 Node.JS crawler by alanfoxye*/

var myRequest = require('request')
var myCheerio = require('cheerio')
var myIconv = require('iconv-lite')
require('date-utils');
var fs = require('fs');
var mysql=require('./lib/mysql.js')

//把所有的source相关字符串和jquery格式化字符串集中，准备后期用数据库进行配置，注意用\"转义字符串中的"

var source_name = "华夏化工网";
var domain = 'http://www.hxchem.net/' //有没有/号很重要，要看newsurl最前面本身有没有/
var myEncoding = "gb2312"
var seedURLs = ['http://hxchem.net/news.php?page=0&&turn_page='];//, 'http://hxchem.net/news.php?page=1&&turn_page=', 'http://hxchem.net/news.php?page=2&&turn_page='];

var seedURL_format = "$('.mainbody>ul>li>a')";
var keywords_format = "";  //没有keywords就用source_name代替
var title_format = "$('.hq_contet>dt').text()";
var date_format = "$('.hq_date').text()";
var author_format = "";  //没有author就用source_name代替
var content_format = "$('.hq_contet>dd').eq(1).text()";

var myURL_reg = 'news/detail?id=';
var allfetches = [];

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
        timeout: 180000  //增加3分钟超时停止
    }
    myRequest(options, callback)
}

//用空循环简单模拟sleep，会导致CPU上升
function sleep(sleepTime) {
    for (var start = +new Date; +new Date - start <= sleepTime;) { }
}

//遍历所有seedURLs
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
        //具体新闻url的列表
        var news_urls = [];

        //从seedURL页面获取所有新闻的url列表所处的html块

        var seedurl_news;

        try {
            seedurl_news = eval(seedURL_format);
        }
        catch (e) { console.log(e) }

        seedurl_news.each(function (i, e) {

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
                    if (date_format == "") fetch.date = null
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

                console.log(fetch);
                ////构建存储json的文件名
                //var filename = source_name + "_" + index + "_" + i + "_" + (new Date()).toFormat("YYYY-MM-DD") + ".json";
                ////存储json
                //fs.writeFileSync(filename, JSON.stringify(fetch));

                //sql insert字符串和参数，尽量使用参数方式不用字符串拼接方式
                var fetchAddSql = 'INSERT INTO fetches(url,source_name,source_encoding,title,keywords,author,publish_date,crawltime,content) VALUES(?,?,?,?,?,?,?,?,?)';
                var fetchAddSql_Params = [fetch.url, source_name, myEncoding, fetch.title, fetch.keywords, fetch.author, fetch.date, fetch.crawltime, fetch.content];

                //执行sql，数据库中fetch表里的url属性是unique的，不把重复的url内容写入数据库
                mysql.query(fetchAddSql, fetchAddSql_Params, function (qerr, vals, fields) {
                    console.log('INSERT ID:', vals);
                });

                sleep(5000); //每爬完1个页面休息5秒钟再爬，防止被网站黑名单
            })
        });
    })
})