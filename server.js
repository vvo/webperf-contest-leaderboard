/**
 * TODO : use events and not callbacks, smarter
 * TODO : scinder donnees wpt et donees BDD
 */

var express = require('express'),
sys = require('sys'),
app = express.createServer(),
wpt = require('./wpt'),
yottaa = require('./yottaa'),
working = false,

participant_base_url = "http://entries.webperf-contest.com/",

nextUpdate = 1*60*60*5,

nbUrlsTodo = 0,

leaderboard = {},

yottaa_scores = {},

// correspondance url <> participant_id
id_url = {},

Client = require('mysql').Client,
client = new Client();

client.user = 'webperf_contest';
client.password = '########';
client.connect();
client.query('USE webperf_contest');

app.use(express.logger());

app.get('/', function(req, res) {

	leaderboard.nextUpdate = nbUrlsTodo > 1 ? 0 : nextUpdate;

	leaderboard.yottaa_data = yottaa_scores;

	res.send("leaderboard(" + JSON.stringify(leaderboard) + ")", {
		'Content-Type': 'application/json',
		'Expires': new Date(Date.now() + 60000),
		'Cache-Control': 'max-age=60'
	});
});

app.get('/wpt-callback', function(req, res) {

	nbUrlsTodo = nbUrlsTodo === 0 ? 0 : nbUrlsTodo-1;

	wpt.getTestData(req.query.id, function(wpt_id, data){

		var participant_id, url, uniqid;
		
		data = data.data;

		// if multiple runs, data.run === array otherwise data.run.firstView
		if (data && data.run && data.run[0].firstView && data.average.firstView.loadTime && parseInt(data.average.firstView.loadTime) > 1) {
			url = data.run[0].firstView.results.URL;
	
			// il est possible qu'arrivé ici on ai plus la relation url <> participant_id, donc si on ne la trouve pas, on va la chercher dans la bdd
			if (id_url[url]) {
				participant_id = id_url[url];
				saveWptResult(participant_id, wpt_id, data);
			} else {
				uniqid = url.replace(participant_base_url, '');
				uniqid = url.replace('/index.html', '');
				client.query("select participant_id from participant where uniqid = '" + uniqid + "'", function(err, results, fields) {
					if (results && results.length > 0) {
						participant_id = results[0].participant_id;
						saveWptResult(participant_id, wpt_id, data);
					}
				});
			}
		}		
	});

	res.send('');
});

function saveWptResult(participant_id, wpt_id, data) {
	client.query("insert into wpt_tests values (" + participant_id + ", '" + wpt_id + "', '" + JSON.stringify(data) + "' , DEFAULT)");
	updateLeaderBoard();
}

function getAllParticipantUrls(callback, even_or_odd) {
	var urltodo = [], url;

	client.query("select participant_id, uniqid from participant where login_sent is true", function(err, results, fields) {
		if (results && results.length > 0) {
			for(var i=0; i<results.length; i+=1) {
				if( typeof even_or_odd === 'undefined' || ( (even_or_odd && i % 2 === 0) || (!even_or_odd && i % 2 !== 0) ) ) {
					url = participant_base_url + results[i].uniqid + "/index.html";
					urltodo.push(url);
					id_url[url] = results[i].participant_id;
				}
			}

			if (callback) {
				callback(urltodo);
			}
		} else {
			if (callback) {
				callback(false);
			}
		}
	});
}

function updateLeaderBoard() {
	var data, newLeaderBoard = [], currentObj, participant_id_done = {}, yottaa_todo_urls = [], r;

	client.query("select w.participant_id, p.gist, w.wpt_id, p.uniqid, UNIX_TIMESTAMP(w.test_date) as date, data, p.name as name, p.twitter as twitter "+
		"from wpt_tests w, participant p where p.participant_id = w.participant_id and p.show_in_leaderboard is true order by test_date DESC", function(err, results, fields) {
			if (results.length > 0) {
				for (var i = 0; i < results.length ; i+=1) {
					r = results [i];
					// comme je n'ai jamais trouvé la solution facile en une requête pour obtenir les derniers tests pour chaque participant, je fais le tri ici
					if (!participant_id_done[results[i].participant_id]) {
						participant_id_done[results[i].participant_id] = true;
						data = JSON.parse(results[i].data);
						currentObj = {
							data : data.average,
							name : r.name,
							date : r.date,
							id : r.participant_id,
							uniqid : r.uniqid,
							wpt_id : r.wpt_id,
							gist : r.gist
						};

						if(results[i].twitter && results[i].twitter != '') {
							currentObj.twitter = results[i].twitter;
						}

						newLeaderBoard.push(currentObj);

						yottaa_todo_urls.push(participant_base_url + results[i].uniqid + "/index.html");
					}
				}

				// les scores yottaa sont récupérés seulement si les tests WPT sont réussis
				yottaa.getResults(yottaa_todo_urls, callbackYottaaGetAllResults);

				leaderboard = {wpt_data : newLeaderBoard, nextUpdate : nbUrlsTodo > 1 ? 0 : nextUpdate};
			}
		});
}

function callbackYottaaGetAllResults(json) {
	var url, id_participant;
	for(url in json) {
		id_participant = id_url[url];
		yottaa_scores[id_participant] = json[url].yottaa_score;
	}
}

function doEvenUrls() {
	getAllParticipantUrls(function(urls) {
		if(urls.length > 0) {
			wpt.start(urls, callbackValidUrlTodo);
		}
	}, true);
}

function doOddUrls() {
	getAllParticipantUrls(function(urls) {
		if(urls.length > 0) {
			wpt.start(urls, callbackValidUrlTodo);
		}
	}, false);
}

// fonction appellée par wpt lorsque l'url est valide pour un test (200 OK)
function callbackValidUrlTodo() {
	nbUrlsTodo += 1;
}

function launchAllTests() {
	nextUpdate = 1*60*60*5;
	doEvenUrls();
	setTimeout(doOddUrls, 1000*60*130); // 130 minutes plus tard
}

//launchAllTests();

//setInterval(launchAllTests, 1000*60*60*5);  // toutes les 5 heures

getAllParticipantUrls(updateLeaderBoard);

//setInterval(updateLeaderBoard, 1000*60*30);

//setInterval(function() {
//	nextUpdate = nextUpdate === 0 ? 0 : nextUpdate-1;
//}, 1000*60);


app.listen(26101);

console.log('Express server started on port %s', app.address().port);
