'use strict';

const REDIRECT_URL = "https://oauth-redirect.googleusercontent.com/r/skyra-elements"

const functions = require('firebase-functions');
const {smarthome} = require('actions-on-google');
const uuidv1 = require('uuid/v1');
const admin = require('firebase-admin');
// Initialize Firebase
admin.initializeApp();
const devicesRef = admin.database().ref('devices');
const statesRef = admin.database().ref('states');

exports.auth = functions.https.onRequest((request, response) => {
  console.log(request.url);
  if (request.query.client_id != "google" || request.query.response_type != "token" || request.query.redirect_uri != REDIRECT_URL) {
    res.status(403).send('Unauthorized');
    return;
  }
  response.redirect("/auth.html" + request._parsedUrl.search);

  // const responseurl = util.format('%s?code=%s&state=%s',
  //   decodeURIComponent(request.query.redirect_uri), 'xxxxxx',
  //   request.query.state);
  // console.log(responseurl);
  // return response.redirect(responseurl);
});

// exports.token = functions.https.onRequest((request, response) => {
//   const grantType = request.query.grant_type
//     ? request.query.grant_type : request.body.grant_type;
//   const secondsInDay = 86400; // 60 * 60 * 24
//   const HTTP_STATUS_OK = 200;
//   console.log(`Grant type ${grantType}`);

//   let obj;
//   if (grantType === 'authorization_code') {
//     obj = {
//       token_type: 'bearer',
//       access_token: '123access',
//       refresh_token: '123refresh',
//       expires_in: secondsInDay,
//     };
//   } else if (grantType === 'refresh_token') {
//     obj = {
//       token_type: 'bearer',
//       access_token: '123access',
//       expires_in: secondsInDay,
//     };
//   }
//   response.status(HTTP_STATUS_OK)
//     .json(obj);
// });

let jwt;
try {
  jwt = require('./jwt-key.json');
} catch (e) {
  console.warn('Service account key is not found');
  console.warn('Report state will be unavailable');
}

const app = smarthome({
  debug: true,
  key: 'AIzaSyAf6bt_d8mkuaL6MzmLiCEvoEShPusVEzY',
  jwt: jwt,
});

const authenticate = (headers) => {
  return headers.authorization.split('Bearer ')[1]
};

// app.use(authenticate);

app.onSync((body, headers) => {
  const uid = authenticate(headers);
  return queryDeviceSync(uid).then((devices) => {
    return {
      requestId: body.requestId,
      payload: {
        agentUserId: uid,
        devices: devices
      }
    };
  });
});

const queryDeviceSync = (uid) => devicesRef.child(uid).once('value')
  .then((snapshot) => {
    var devices = [];
    snapshot.forEach(childSnapshot => {
      var device = childSnapshot.val()
      device['id'] = childSnapshot.key
      devices.push(device);
    });
    return devices;
  });

const queryStateRef = (uid) => statesRef.child(uid);

const queryState = (uid, deviceId) => queryStateRef(uid, deviceId).child(deviceId).once('value');

app.onQuery((body, headers) => {
  const uid = authenticate(headers);
  const {requestId} = body;
  const payload = {
    devices: {},
  };
  const queryPromises = [];
  for (const input of body.inputs) {
    for (const device of input.payload.devices) {
      const deviceId = device.id;
      queryPromises.push(queryState(uid, deviceId)
        .then((data) => {
          // Add response to device payload
          payload.devices[deviceId] = data;
        }
        ));
    }
  }
  // Wait for all promises to resolve
  return Promise.all(queryPromises).then((values) => ({
    requestId: requestId,
    payload: payload,
  })
  );
});

app.onExecute((body, headers) => {
  const uid = authenticate(headers);
  const userQueryStateRef = queryStateRef(uid);
  const {requestId} = body;
  const payload = {
    commands: [{
      ids: [],
      status: 'SUCCESS',
      states: {
        online: true,
      },
    }],
  };
  for (const input of body.inputs) {
    for (const command of input.payload.commands) {
      for (const device of command.devices) {
        const deviceId = device.id;
        payload.commands[0].ids.push(deviceId);
        for (const execution of command.execution) {
          const {params} = execution;
          userQueryStateRef.child(deviceId).update(params);
        }
      }
    }
  }
  return {
    requestId: requestId,
    payload: payload,
  };
});

exports.ha = functions.https.onRequest(app);


// exports.requestsync = functions.https.onRequest((request, response) => {
//   const headers = request.headers;
//   if (!headers.authorization || !headers.authorization.startsWith('Bearer ')) {
//     response.status(403).send('Unauthorized');
//     return;
//   }
//   const uid = request.headers.authorization.split('Bearer ')[1]

//   console.info('Request SYNC for user ' + uid);
  
//     .then((data) => {
//       console.log('Request sync completed');
//       response.json(data);
//     }).catch((err) => {
//       console.error(err);
//     });
// });

exports.syncNewDevice = functions.database.ref('devices/{user_id}/{device_id}').onCreate((event, context) => {
  console.info('New device added. Running Sync for ' + context.params.user_id);
  return app.requestSync(context.params.user_id).then((res) => {
    console.log("success")
    console.log(res)
  })
  .catch((res) => {
    console.log("error")
    console.log(res)
  })
});

exports.syncRemovedDevice = functions.database.ref('devices/{user_id}/{device_id}').onDelete((event, context) => {
  console.info('Device removed. Running Sync for ' + context.params.user_id);
  return app.requestSync(context.params.user_id).then((res) => {
    console.log("success")
    console.log(res)
  })
  .catch((res) => {
    console.log("error")
    console.log(res)
  })
});

/**
 * Send a REPORT STATE call to the homegraph when data for any device id
 * has been changed.
 */
exports.reportstate = functions.database.ref('states/{user_id}/{device_id}').onUpdate((event, context) => {
  console.info('Firebase write event triggered this cloud function');
  if (!app.jwt) {
    console.warn('Service account key is not configured');
    console.warn('Report state is unavailable');
    return;
  }
  const snapshotVal = event.after.val();
 
  console.log(context)

  const postData = {
    requestId: uuidv1(),
    agentUserId: context.params.user_id,
    payload: {
      devices: {
        states: {
          /* Report the current state of the device */
          [context.params.device_id]: snapshotVal,
        },
      },
    },
  };

  return app.reportState(postData)
    .then((data) => {
      console.log('Report state came back');
      console.info(data);
    });
});
