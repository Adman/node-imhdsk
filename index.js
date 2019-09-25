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
