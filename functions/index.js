/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const REDIRECT_URL = "https://oauth-redirect.googleusercontent.com/r/skyra-elements"

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const ha = require('./ha');

const app = express();

admin.initializeApp(functions.config().firebase);

// Express middleware that validates Firebase ID Tokens passed in the Authorization HTTP header.
// The Firebase ID token needs to be passed as a Bearer token in the Authorization HTTP header like this:
// `Authorization: Bearer <Firebase ID Token>`.
// when decoded successfully, the ID Token content will be added as `req.user`.
const authenticate = (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    res.status(403).send('Unauthorized');
    return;
  }
  console.log(req.headers.authorization)
  const idToken = req.headers.authorization.split('Bearer ')[1];
  admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
    req.user = decodedIdToken;
    next();
  }).catch(error => {
    res.status(403).send('Unauthorized');
  });
};

app.use(authenticate);

// POST /api/devices
// Create a new device
app.post('/api/devices', (req, res) => {
  const device = req.body;
  //TODO: check the device json is correct?
  
  admin.database().ref(`/users/${req.user.uid}/devices`).push(device).once('value')
  .then(snapshot => {
    const val = snapshot.val();
    res.status(201).json(val);
  }).catch(error => {
    console.log('Error detecting sentiment or saving message', error.message);
    res.sendStatus(500);
  });
});

// GET /api/devices?type={type}
// Get all devices, optionally specifying a type to filter on
app.get('/api/devices', (req, res) => {
  const type = req.query.type;
  let query = admin.database().ref(`/users/${req.user.uid}/devices`);

  if (type && ['light', 'outlet', 'switch', 'thermostat', 'scene'].indexOf(type) > -1) {
    // Update the query with the valid category
    query = query.orderByChild('properties/type').equalTo("action.devices.types."+type.toUpperCase());
  } else if (type) {
    return res.status(404).json({errorCode: 404, errorMessage: `type '${type}' not found`});
  }

  query.once('value').then(snapshot => {
    var devices = [];
    snapshot.forEach(childSnapshot => {
      devices.push({key: childSnapshot.key, device: childSnapshot.val().device});
    });

    return res.status(200).json(devices);
  }).catch(error => {
    console.log('Error getting devices', error.message);
    res.sendStatus(500);
  });
});

// GET /api/device/{deviceId}
// Get details about a device
app.get('/api/device/:deviceId', (req, res) => {
  const deviceId = req.params.deviceId;
  admin.database().ref(`/users/${req.user.uid}/devices/${deviceId}`).once('value').then(snapshot => {
    if (snapshot.val() !== null) {
      // Cache details in the browser for 5 minutes
      res.set('Cache-Control', 'private, max-age=300');
      res.status(200).json(snapshot.val());
    } else {
      res.status(404).json({errorCode: 404, errorMessage: `device '${deviceId}' not found`});
    }
  }).catch(error => {
    console.log('Error getting device details', deviceId, error.message);
    res.sendStatus(500);
  });
});

// Callback url
app.post('/api/callback', (req, res) => { 
  var ref = admin.database().ref(`/users/${req.user.uid}/callback`);
  ref.set(req.body.url);
  ref.once('value')
  .then(snapshot => {
    const val = snapshot.val();
    res.status(201).json(val);
  }).catch(error => {
    console.log('Error saving callback url', error.message);
    res.sendStatus(500);
  });
});

// Auth a user for google
const auth = express();
auth.get('/auth', (req, res) => {
  console.log(req.url);
  if (req.query.client_id != "google" || req.query.response_type != "token" || req.query.redirect_uri != REDIRECT_URL) {
    res.status(403).send('Unauthorized');
    return;
  }
  res.redirect("/auth.html" + req._parsedUrl.search);
  // res.redirect("https://710d0fb4.ngrok.io/auth" + req._parsedUrl.search);
});

auth.get('/token', (req, res) => {
    res.status(403).send('Unauthorized');
});


// Expose the API as a function
exports.ha = functions.https.onRequest(ha);
exports.api = functions.https.onRequest(app);
exports.auth = functions.https.onRequest(auth);