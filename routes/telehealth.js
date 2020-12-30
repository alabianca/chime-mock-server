var express = require('express');
var router = express.Router();

const AWS = require('aws-sdk');
const uuid = require('uuid/v4');
const jwt = require('jsonwebtoken');
const supersecretjwtkey = 'sosecret';

const chime = new AWS.Chime({region: 'us-east-1'});

const meetings = {};
const attendees = {};

const verifyJwt = (req, res, next) => {
    const token = req.headers.authorization.split(' ')[1];
    if (!token) {
		return res.status(401).end()
    }
    let payload
	try {
		payload = jwt.verify(token, supersecretjwtkey)
	} catch (e) {
		if (e instanceof jwt.JsonWebTokenError) {
			return res.status(401).end()
		}
		return res.status(400).end()
	}

	// Finally, return the welcome message to the user, along with their
	// username given in the token
    req.displayName = payload.displayName;
    req.token = payload.token;
    next();
}

router.get('/active-participants', verifyJwt, (req, res) => {
    const token = req.token;
    const participants = [];
    for (const ai in attendees[token]) {
        const attendee = attendees[token][ai];
        participants.push(attendee)
    }
    console.log(participants)
    res.status(200);
    res.json({response: participants});
});

router.get('/appointment', (req, res) => {
    const info = {appointmentId: 9999, start: new Date(), providerName: 'Dr. Fauci'}
    res.status(200);
    res.json(info);
});

router.post('/join-session', (req, res) => {
    const token = req.query['token'];
    const displayName = req.query['displayName'];
    const jwtString = jwt.sign({token, displayName}, supersecretjwtkey)

    const joinInfo = {
        jwt: jwtString,
        telehealthVisitUserId: 99,
    }

    res.status(200);
    res.json(joinInfo);
});

router.post('/start-video', verifyJwt, async (req, res) => {
    const token = req.token;
    const displayName = req.displayName;
    console.log(token);
    console.log(displayName)
    if (!meetings[token]) {
        console.log('MUST CREATE MEETING')
        meetings[token] = await chime.createMeeting({
            ClientRequestToken: uuid(),
            MediaRegion: 'us-east-1',
        })
        .promise();
        attendees[token] = {};
    }

    const joinInfo = {
        Title: token,
        MEETINGINFO: {
            Meeting: meetings[token].Meeting,
        },
        STATUS: 'SUCCESS',
        ATTENDEEINFO: {
            Attendee: (await chime.createAttendee({
                MeetingId: meetings[token].Meeting.MeetingId,
                ExternalUserId: uuid(),
            }).promise()
            ).Attendee
        }
        
    }
    attendees[token][joinInfo.ATTENDEEINFO.Attendee.AttendeeId] = {
        DISPLAYNAME: displayName,
        APPOINTMENTID: '9999',
        USERNAME: displayName, // PTH_WEB
        STARTTIME: new Date().toDateString(), // ISO date
        ATTENDEEID: joinInfo.ATTENDEEINFO.Attendee.AttendeeId, // Chime ID
        TYPE: 'PATIENT',
        TELEHEALTHVISITUSERID: '99',
    }
    res.status(201);
    res.json({response: joinInfo});
});

module.exports = router;