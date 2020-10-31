const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const moment = require('moment');

//Add your Twitch ClientID and ClientSecret
const clientId = '';
const clientSecret = '';

//Set the API Rate Limit for Axios to 13 per second.
/* 
    Twitch API rate is 800 per minute. This is 780 per minute.
*/
const api = rateLimit(axios.create(), { maxRPS: 13 });

//Set counters for Clips and API Calls
let clipCount = 0;
let callCount = 0;

//Create function for looping our API calls after we have a token
function twitchClips(token, endTime) {

    //Set the start time to be 1 hour prior to the end time
    //Also removing the milliseconds from toISOString and adding a "Z" (this isn't needed, but in testing I did this and just never removed it)
    let startTime = moment(endTime).subtract(1, 'hours').toISOString().split('.')[0]+"Z";

    //Get Clips with client and auth headers, encoding the ending time and starting time
    api.get(`https://api.twitch.tv/helix/clips?broadcaster_id=94267141&ended_at=${encodeURI(endTime)}&first=100&started_at=${encodeURI(startTime)}`, {
        headers: {
            'Client-Id': clientId,
            Authorization: `Bearer ${token}`
        }
    }).then(clips => {
        
        //Get current API Call Count and add 1.
        callCount = callCount + 1;
        //Get current Clips Count and add the length of Clips in the array.
        clipCount = clipCount + clips.data.data.length;
        
        //If the date is May 24, 2016 then we can stop making calls. (Clips started on Twitch on the 25th)
        if (moment(endTime).year() === 2016 && moment(endTime).month() === 4 && moment(endTime).day() === 24) {
            console.log('Done!');
        } else {
            //Log results and use this exact same function to get the next set of results
            console.log('Calls:', callCount, '\t Total Clips:', clipCount, '\t End:', endTime, '\t Start:', startTime, '\t Clips Added:', clips.data.data.length);
            twitchClips(token, startTime);
        }

    }).catch(err => {
        console.log(err)
    });

};

//Get our API token
api.post(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`).then(res => {

    //Run our function, passing the token and the datetime in RFC3339 (ISO)
    twitchClips(res.data.access_token, moment().minute(0).second(0).toISOString().split('.')[0]+"Z");

}).catch(err => {
    console.log(err);
});