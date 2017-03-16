/* 2017.3.16 Node.JS crawler by alanfoxye*/

var myRequest = require('request')
var myCheerio = require('cheerio')
var myIconv = require('iconv-lite')
require('date-utils');
var fs = require('fs');
//var async = require('async');

//把所有的source相关字符串和jquery格式化字符串集中，准备后期用数据库进行配置，注意用\"转义字符串中的"

var source_name = "安迅思 ICIS";
var domain = 'http://e.icis-china.com'
var myEncoding = "utf-8"
var seedURLs = ['http://e.icis-china.com/news?page=1', 'http://e.icis-china.com/news?page=2'];

var seedURL_format = "$('.com-list>ul>li>div[class=\"text\"]>a')";
var keywords_format = " $('meta[name=\"keywords\"]').eq(1).attr(\"content\")";
var title_format = "$('title').text()";
var date_format = "$('span[class=\"date\"]').eq(0).text()";
var author_format = "$('.editor>p').eq(0).text()";
var content_format = "$('.editor').text()";

var myURL_reg = 'news/detail?id='

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
        headers: headers
    }
    myRequest(options, callback)
}

//遍历所有seedURLs
seedURLs.forEach(function (myseedURL,index) {
    //爬取seedURL    
    request(myseedURL, function (err, res, body) {

        //用iconv转换编码
        var html = myIconv.decode(body, myEncoding);
        //console.log(html);

        //准备用cheerio解析html
        var $ = myCheerio.load(html, { decodeEntities: true });

        //具体新闻url的列表
        var news_urls = [];

        //从seedURL页面获取所有新闻的url列表所处的html块
        eval(seedURL_format).each(function (i, e) {
            //得到具体新闻url
            var myURL = domain + $(e).attr("href");
            console.log(myURL);
            //console.log(e);

            //获取具体新闻页，注意node.js的异步模式，不保证seedurl或新闻url的执行次序！
            request(myURL, function (err, res, body) {
                //用iconv转换编码
                var html_news = myIconv.decode(body, myEncoding);
                //console.log(html_news);

                //准备用cheerio解析html_news
                var $ = myCheerio.load(html_news, { decodeEntities: true });               

                //动态执行format字符串，构建json对象准备写入文件或数据库
                var fetch = {};
                fetch.encoding = myEncoding;  //编码
                fetch.keywords = eval(keywords_format);  //关键词
                fetch.title = eval(title_format);  //标题
                fetch.date = eval(date_format);    //刊登日期            
                fetch.author = eval(author_format);  //作者
                fetch.content = eval(content_format).replace("\r\n"+fetch.author, "");  //内容,是否要去掉作者信息自行决定
                fetch.author = fetch.author.replace("作者：", "");   //作者格式修改，去掉前面的"作者："
                fetch.crawltime = (new Date()).toFormat("YYYY-MM-DD HH24:MI:SS");  //爬取时间

                console.log(fetch);               
                
                //构建存储json的文件名
                var filename = source_name + "_" + index + "_" + i + "_" + (new Date()).toFormat("YYYY-MM-DD") + ".json";
                //存储json
                fs.writeFileSync(filename, JSON.stringify(fetch));
            })
        });        
        
    })
})

 




