const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const moment = require('moment');
const fs = require('fs');

//Add your Twitch ClientID and ClientSecret
const clientId = '';
const clientSecret = '';
const broadcasterId = '94267141'; //Sean_VR

//Set the API Rate Limit for Axios to 13 per second.
/* 
    Twitch API rate is 800 per minute. This is 780 per minute.
*/
const api = rateLimit(axios.create(), { maxRPS: 13 });

//Set counters for Clips and API Calls
let clipCount = 0;
let callCount = 0;

//Data collection
let clips = {
    data: []
};

//Function to handle writing to JSON as well as duplicate checking
const writeJSON = () => {

    //Duplicate checking function that returns true or false
    const checkDupes = () => {
        let clipsArr = clips.data.map(obj => {
            return obj.id;
        });
        return clipsArr.some((item, index) => {
            return clipsArr.indexOf(item) != index;
        });
    };

    //Convert clips to human-friendly JSON
    let json = JSON.stringify(clips, null, 4);
    fs.writeFile(`./data/clips.json`, json, 'utf8', (err) => {
        if (err) {
            console.log(err);
        } else {
            if (checkDupes(clips.data)) {
                console.log(`-------------------------------WARNING: FILE WRITTEN BUT DUPLICATES WERE FOUND-------------------------------`);
            } else {
                console.log(`All clips have been written to file. Collection complete.`);
            }            
        }
    });
}

//Create function for looping our API calls after we have a token
function twitchClips(token, endTime) {

    //Set the start time to be 1 hour prior to the end time
    //Also removing the milliseconds from toISOString and adding a "Z" (this isn't needed, but in testing I did this and just never removed it)
    let startTime = moment(endTime).subtract(1, 'hours').toISOString().split('.')[0]+"Z";

    //Get Clips with client and auth headers, encoding the ending time and starting time
    api.get(`https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}&ended_at=${encodeURI(endTime)}&first=100&started_at=${encodeURI(startTime)}`, {
        headers: {
            'Client-Id': clientId,
            Authorization: `Bearer ${token}`
        }
    }).then(clipsRes => {

        //Check for a response with 98 clips in it, if this happens we are likely to have some responses that are higher than the 100 hard cap
        if (clipsRes.data.data.length >= 98) {
            console.log(`-------------------------------MAXIMUM CLIP RETURN! (${clipsRes.data.data.length}) ENDING PROCESS-------------------------------`);
            console.log(`--------------------------------Suggest lowering the 'hours' of Start Time and try running again--------------------------------`);
            //End looping as we have a very high chance of not getting all the clips in the response
            return;
        };

        //Set current Month and Year
        //NOTE: MomentJS stores months in an array index, so we need to add one
        let currMonth = moment(startTime).month() + 1;
        let currYear = moment(startTime).year();

        //Add data to collection
        const data = clipsRes.data.data.map(clipsObj => {
            clips.data.push(clipsObj);
        });

        //Use promise to ensure that the next API call waits until all the clips have been pushed to the collection array
        Promise.all(data).then(() => {
          
            //Get current API Call Count and add 1.
            callCount = callCount + 1;
            //Get current Clips Count and add the length of Clips in the array.
            clipCount = clipCount + clipsRes.data.data.length;

            //If the date is May 24, 2016 then we can stop making calls. (Clips started on Twitch on the 25th)
            if (currYear === 2016 && currMonth === 5 && moment(endTime).date() === 24) {
                console.log('----------------Done! Writing array to file.----------------');
                writeJSON(currYear, currMonth);
            } else {
                //Log results and use this exact same function to get the next set of results
                console.log('Requests:', callCount, '\t Clips:', clipCount, '\t Added:', clipsRes.data.data.length, '\t Start:', startTime, '\t End:', endTime);
                twitchClips(token, startTime);
            }
        }).catch(err => {
            console.log(err);
        });

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