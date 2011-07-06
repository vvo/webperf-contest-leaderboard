var http = require('http'),
url = require('url'),
querystring = require('querystring'),
sys = require('sys'),
maxGetUrls = 10,
yottaa_url = "http://www.yottaa.com/url/urls_detail";

function getResults(urls, callback) {
	var newArrays = [], nbUrls = urls.length, parts = parseInt(nbUrls / maxGetUrls)+1, i = 0, j = 0;

	// on ne fait pas plus de 10 demandes en même temps
	for (; i < parts; i+=1) {
		if (urls[i*maxGetUrls]) {
			newArrays.push(urls.slice(i*maxGetUrls, i*maxGetUrls+maxGetUrls));
		}
	}

	for (; j < parts; j++) {
		(function(j){
			var urls = newArrays[j];
if(urls && urls.length > 0) {
				client = http.createClient(80, url.parse(yottaa_url).hostname),

				request = client.request('GET', '/url/urls_detail?' + querystring.stringify({url : urls, groups : ["yottaa_score"]}) , {
					'host': url.parse(yottaa_url).hostname
				});

//console.log(yottaa_url + '/url/urls_detail?'+querystring.stringify({url : urls, groups : ["yottaa_score"]}));

				request.end();

			request.on('response', function(response) {
				var json_string = "";

				response.on('data', function(chunk){
					json_string += chunk;
				});

				response.on('end', function(){
					console.log(json_string);
					callback(JSON.parse(json_string));
				});
			});
}
		})(j)
	}
}

exports.getResults = getResults;

