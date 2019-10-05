const request = require('request');
const cheerio = require('cheerio');


function parse_routes(body)
{
    const $ = cheerio.load(body)

    var html_routes = $('div#content div.sp > table');

    var routes = [];
    html_routes.each(function(i, elem) {
        /* skip first table */
        if (i == 0)
            return;

        var trs = $(this).find('> tbody > tr');
        
        var drives = [];
        var line;

        /* process rows in table */
        trs.each(function(itr, ielem) {
            /* skip header */
            if (itr == 0)
                return;

            var l = $(ielem).find('> td:first-child > span.linka');
            if (l.length > 0)
                line = l.text();

            var walker = $(ielem).find('td:first-child > img[src$="/chodec.png"]');
            if (walker.length > 0) {
                var start = $(ielem).find('> td:nth-child(2) > b:first-child').text();
                var maybe_dest = $(ielem).find('> td:nth-child(2) > b:nth-child(2)');
                var dest = start;
                if (maybe_dest.length > 0)
                    dest = $(maybe_dest).text();

                var length = $(ielem).find('> td:nth-child(2)').html();
                length = length.replace(/^.*> /g, '');

                var drive = {walk: true, start: start, dest: dest,
                             length: length};
                drives.push(drive);
            }

            var tables = $(ielem).find('> td:first-child > table');
            if (tables.length > 0) {
                var first_table = $(tables).get(0);
                var second_table = $(tables).get(1);

                var begin_time = $(first_table).find('tr > td:first-child > b').text();
                var start = $(first_table).find('tr > td:nth-child(2) > b').text();
                var end_time = $(second_table).find('tr > td:first-child > b').text();
                var dest = $(second_table).find('tr > td:nth-child(2) > b').text();

                var length_div = $(ielem).find('td > div').get(1);
                var length = $(length_div).find('> table > tbody > tr:first-child > td:first-child').text();
                length = length.replace(/^.*, /g, '').replace(/\s*$/g, '');

                var drive = {walk: false, start: start, dest: dest,
                             begin_time: begin_time, end_time: end_time,
                             line: line, length: length};
                drives.push(drive);
            }
        });
        routes.push(drives);
    }); 

    return routes;
}


exports.get_routes = function(options) {
    var today = new Date();
    var defaults = {
        city: 'ba',
        date: today.getDate() + '.' +
              (today.getMonth()+1) + '.' +
              today.getFullYear(),
        time: today.getHours() + ':' + today.getMinutes()
    };

    var props = Object.assign(defaults, options);
    var url = 'http://imhd.sk/'
            +  props.city
            + '/planovac-cesty-vyhladanie-spojenia.html';
    
    var params = {
        'spojenieodkial': props.from,
        'spojeniekam': props.to,
        'cas': props.time,
        'datum': props.date
    };

    return new Promise(function(resolve, reject) {
        request.get({url: url, qs: params}, function(err, response, body) {
            if (err)
                return reject(err);
            else
                return resolve(parse_routes(body));
        })   
    });
}


exports.get_livetable = function(stop_id) {
    var req1 = {
        url: 'https://imhd.sk/rt/sio2/',
        qs: {
            'EIO': 3,
            'transport': 'polling'
        },
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:69.0) Gecko/20100101 Firefox/69.0'
        }
    }

    var req2 = {
        url: 'https://imhd.sk/rt/sio2/',
        body: '26:42[\"tabStart\",[' + stop_id + ',[\"*\"]]]',
        qs: {
            'EIO': 3,
            'transport': 'polling',
            't': 'Mremom1',
            'sid': ''
        },
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:69.0) Gecko/20100101 Firefox/69.0',
            'Cookie': ''
        }
    }

    var req3 = {
        url: 'https://imhd.sk/rt/sio2/',
        qs: {
            'EIO': 3,
            'transport': 'polling',
            't': 'Mremom1',
            'sid': ''
        },
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:69.0) Gecko/20100101 Firefox/69.0',
            'Cookie': ''
        }
    }

    var req_mapping = {
        url: 'https://imhd.sk/ba/api/sk/cp',
        qs: {
            'op': 'gsn',
            'id': ''
        },
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:69.0) Gecko/20100101 Firefox/69.0',
            'Cookie': ''
        }
    }

    return new Promise(function(resolve, reject) {

    request.get(req1, function(err, response, body) {
        body = JSON.parse(body.replace(/^.*\{/g, '\{'));

        var sid = body.sid;
        req2.qs['sid'] = sid;
        req3.qs['sid'] = sid;

        var sid_cookie = request.cookie('io=' + sid);
        req2.headers['Cookie'] = sid_cookie;
        req3.headers['Cookie'] = sid_cookie;
        req_mapping.headers['Cookie'] = sid_cookie;

        request.post(req2, function(err2, response2, body2) {
            request.get(req3, function(err3, response3, body3) {
                var tabs = JSON.parse(body3.replace(/^.*tabs\",/, '')
                                           .replace(/\]$/, ''));

                var ids = [];
                Object.keys(tabs).forEach(function(key) {
                    var table_id = tabs[key].zastavka;
                    if (!(table_id in ids))
                        ids.push(table_id);

                    for (var i=0; i < tabs[key].tab.length; i++) {
                        var line = tabs[key].tab[i];

                        var finish_id = line.cielZastavka;
                        if (!(finish_id in ids))
                            ids.push(finish_id);

                        if ('lastZ' in line && line.lastZ != 0)
                            ids.push(line.lastZ);
                    }
                });

                req_mapping.qs['id'] = ids.join();

                /* Get names of destinations */
                request.get(req_mapping, function(e, r, b) {
                    var mapping = JSON.parse(b).sn;

                    var out = {}

                    /* Remap tabs */
                    Object.keys(tabs).forEach(function(key) {
                        var t = tabs[key];
                        out[key] = {
                            stop_id: t.zastavka,
                            stop_name: mapping[t.zastavka],
                            platform: t.nastupiste,
                            timestamp: t.timestamp,
                            lines: []
                        };

                        var current_time = new Date(t.timestamp);

                        t.tab.forEach(function(line) {
                            var delay = 0;
                            if ('casDelta' in line)
                                delay = line.casDelta;

                            var last_stop_id = -1;
                            var last_stop_name = ''
                            if ('lastZ' in line) {
                                last_stop_id = line.lastZ;
                                if (last_stop_id != 0)
                                    last_stop_name = mapping[last_stop_id];
                            }

                            var line_time = new Date(line.cas);
                            var leaving_in = (line_time.getTime() -
                                              current_time.getTime()) / 1000;

                            if (leaving_in < 0)
                                leaving_in = 0;

                            out[key].lines.push({
                                line: line.linka,
                                vehicle: line.issi,
                                destination_id: line.cielZastavka,
                                destination_name: mapping[line.cielZastavka],
                                time: line.cas,
                                leaving_in_secs: leaving_in,
                                delay: delay,
                                type: line.typ,
                                last_stop_id: last_stop_id,
                                last_stop_name: last_stop_name
                            });
                        });
                    });
                    return resolve(out);
                });
            });
        });
    });

    });
}
