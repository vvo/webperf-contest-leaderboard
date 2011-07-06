var http = require('http'),
url = require('url'),
querystring = require('querystring'),
xml2js = require('xml2js'),
sys = require('sys'),

wpt = 'http://www.webpagetest.org/runtest.php',

wptParams = {
	'location': 'Paris_IE7.custom',
	'bwIn' : '3360',
	'bwOut' : '384',
	'runs' : '6',
	'video' : '1',
	'latency' : '70',
	'private': '1',
	'f': 'xml',
	'callback': 'http://webperf-contest.com/leaderboard-4cf57ddcc7153/wpt-callback'
};

launchTests = function(urls, callbackIfValidUrl) {

	if (urls) {
		var i = 0, limit = urls.length;

		for (; i < limit; i += 1) {

			(function(i) {

				setTimeout(function() {
					var urlObj = url.parse(urls[i]);

					var client = http.createClient(80, urlObj.hostname);

					// console.log(urlObj.pathname);

					var request = client.request('GET', urlObj.pathname, {
						'host': urlObj.hostname,
						'User-Agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1; PTST 2.247)'
					});

					request.end();

					request.on('response', function(response) {
						if (response.statusCode == 200) {

							console.log("Will launch test for url : " + urls[i] + " (200 OK)");

							callbackIfValidUrl();

							wptParams.url = urlObj.href;

							// launch test
							var client = http.createClient(80, url.parse(wpt).hostname);

							var request = client.request('GET', url.parse(wpt).pathname + '?' + querystring.stringify(wptParams), {
								'host': url.parse(wpt).hostname
							});

							request.end();
						}
					});
				}, (Math.floor(Math.random()*150000)+5000)); // entre 5 et 150 secondes de délai pour le lancement de la requête

			})(i);
		}
	}

}

getTestData = function(id, callback) {
	var xml;
	
	var client = http.createClient(80, url.parse(wpt).hostname);

	var request = client.request('GET', '/xmlResult/' + id + '/' , {
		'host': url.parse(wpt).hostname
	});

	request.end();

	request.on('response', function(response) {
		response.on('data', function(chunk){
			xml += chunk;
		});
		
		response.on('end', function(){
			var parser = new xml2js.Parser();
			parser.addListener('end',
				function(result) {
					callback(id, result);
				});

			parser.parseString(xml);
		});
	});
}

exports.start = launchTests;
exports.getTestData = getTestData;