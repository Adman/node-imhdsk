# node-imhdsk

This is a nodejs port of [python-imhdsk-api](https://github.com/mrshu/python-imhdsk-api)

## Installation

`$ npm i node-imhdsk`

## Usage

```javascript
const imhdsk = require('node-imhdsk');
var options = {'from': 'mlyny',
               'to': 'patronka',
               'time': '23:00',
               'date': '25.9.2019'}
imhdsk.get_routes(options).then(function(res) {
    console.log(res)
});
```

### Available options

| parameter | type    | description                                             |
| --------- | ------- | ------------------------------------------------------- |
| `city`    | string  | City in Slovakia supported by imhd.sk. Defaults to `ba` |
| `from`    | string  | Starting point (required).                              |
| `to`      | string  | Destination (required).                                 |
| `time`    | string  | Departure time. Defaults to current time.               |
| `date`    | string  | Departure date. Defaults to current date.               |


*Beware that by using this you might be violating imhd.sk ToS*
