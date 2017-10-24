/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/
'use strict';

const Alexa = require('alexa-sdk');
const nodeGeocoder = require('node-geocoder');
const turfBuffer = require('@turf/buffer');
const {
    point: turfPoint
} = require("@turf/helpers");
const turfBbox = require("@turf/bbox");

const request = require('request-promise');

const gc_options = {
    provider: 'openstreetmap',
    language: 'de'
};

var geocoder = nodeGeocoder(gc_options);

const APP_ID = 'ENTER ID HERE';

const languageStrings = {
    'en': {
        translation: {
            SKILL_NAME: 'ClimateBo(a)t',
            HELP_MESSAGE: 'HELP MESSAGE',
            HELP_REPROMPT: 'HELP REPROMPT',
            STOP_MESSAGE: 'Goodbye!',
        },
    },
    'en-US': {
        translation: {
            SKILL_NAME: 'Climate Bo(a)t',
        },
    },
    'en-GB': {
        translation: {
            SKILL_NAME: 'Climate Bo(a)t',
        },
    },
    'de': {
        translation: {
            SKILL_NAME: 'KlimaBo(a)t',
            GET_FACT_MESSAGE: 'Hier ist das Wetter: ',
            HELP_MESSAGE: 'Du kannst sagen, „Wie ist das Wetter?“, oder du kannst „Beenden“ sagen... Wie kann ich dir helfen?',
            HELP_REPROMPT: 'Wie kann ich dir helfen?',
            STOP_MESSAGE: 'Auf Wiedersehen!',
        },
    },
};

const geocodeAction = function geocodeAction(str, phenomenon) {
    return geocoder.geocode(str)
        .then(function (res) {
            console.log(res);
            if (res.length === 0) {
                throw new Error('Ich konnte den Ort ' + str + ' nicht finden')
            }
            var point = turfPoint([res[0].longitude, res[0].latitude]);
            var buffered = turfBuffer(point, 10, 'kilometers');
            var [minX, minY, maxX, maxY] = turfBbox(buffered);

            const url = `https://api.opensensemap.org/boxes/data?phenomenon=${phenomenon}&columns=value&bbox=${minX},${minY},${maxX},${maxY}&from-date=${new Date(new Date().getTime() - 600000).toISOString()}`;
            return request(url).then(function (result) {
                let [header, ...rest] = result.split('\n')
                if (rest.length === 1) {
                    throw new Error('Für diesen Ort konnte ich leider keine Daten finden')
                }
                rest.pop()
                rest = rest.map(function (v) {
                    return parseFloat(v)
                })
                var stack = 0

                rest.forEach(function (element) {
                    stack += element
                });
                var average = stack / rest.length;
                return average.toFixed(1).replace(".", " komma ");
            })
        });
}

const handlers = {
    'LaunchRequest': function () {
        // Standard Request ohne crap...
        this.emit(':tell', 'Bitte frage explizit nach dem Wetter o.Ä.');
    },
    'AMAZON.HelpIntent': function () {
        const speechOutput = this.t('HELP_MESSAGE');
        const reprompt = this.t('HELP_MESSAGE');
        this.emit(':ask', speechOutput, reprompt);
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', this.t('STOP_MESSAGE'));
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', this.t('STOP_MESSAGE'));
    },
    'getWeatherIntent': function () {
        var location_input = this.event.request.intent.slots.location.value;

        geocodeAction(location_input, 'Temperatur')
            .then((result) => {
                this.emit(':tell', `Die Temperatur in ${location_input} beträgt durchschnittlich ${result} Grad Celsius`);
            })
            .catch(function (err) {
                this.emit(':tell', err.message)
            })
    },
    'getFeinstaubIntent': function () {
        var location_input = this.event.request.intent.slots.location.value;

        geocodeAction(location_input, 'PM10')
            .then((result) => {
                this.emit(':tell', `Die Feinstaubkonzentration in ${location_input} beträgt durchschnittlich ${result} Mükrogramm pro Kubikmeter`);
            })
            .catch((err) => {
                this.emit(':tell', err.message)
            })
    },
};

exports.handler = function (event, context) {
    const alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};
