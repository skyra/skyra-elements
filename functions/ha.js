'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');

const app = express();
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
  req.user = {
  	uid: req.headers.authorization.split('Bearer ')[1]
  };
  next();
};

app.use(authenticate);

function getAccessToken(request) {
  return request.headers.authorization ? request.headers.authorization.split(' ')[1] : null;
};

/**
   *
   * action: {
   *   initialTrigger: {
   *     intent: [
   *       "action.devices.SYNC",
   *       "action.devices.QUERY",
   *       "action.devices.EXECUTE"
   *     ]
   *   },
   *   httpExecution: "https://example.org/device/agent",
   *   accountLinking: {
   *     authenticationUrl: "https://example.org/device/auth"
   *   }
   * }
   */
  app.post('/ha', function (req, res) {
    console.log('post /ha', req.headers);
    let reqdata = req.body;
    console.log('post /ha', reqdata);

    let authToken = getAccessToken(req);
    let uid = req.user.uid;

    if (!reqdata.inputs) {
      res.status(401).set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }).json({error: "missing inputs"});
      return;
    }
    for (let i = 0; i < reqdata.inputs.length; i++) {
      let input = reqdata.inputs[i];
      let intent = input.intent;
      if (!intent) {
        res.status(401).set({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }).json({error: "missing inputs"});
        continue;
      }
      switch (intent) {
        case "action.devices.SYNC":
          console.log('post /ha SYNC');
          /**
           * request:
           * {
           *  "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
           *  "inputs": [{
           *      "intent": "action.devices.SYNC",
           *  }]
           * }
           */
          sync({
            uid: uid,
            auth: authToken,
            requestId: reqdata.requestId
          }, res);
          break;
        case "action.devices.QUERY":
          console.log('post /ha QUERY');
          /**
           * request:
           * {
           *   "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
           *   "inputs": [{
           *       "intent": "action.devices.QUERY",
           *       "payload": {
           *          "devices": [{
           *            "id": "123",
           *            "customData": {
           *              "fooValue": 12,
           *              "barValue": true,
           *              "bazValue": "alpaca sauce"
           *            }
           *          }, {
           *            "id": "234",
           *            "customData": {
           *              "fooValue": 74,
           *              "barValue": false,
           *              "bazValue": "sheep dip"
           *            }
           *          }]
           *       }
           *   }]
           * }
           */
          query({
            uid: uid,
            auth: authToken,
            requestId: reqdata.requestId,
            devices: reqdata.inputs[0].payload.devices
          }, res);

          break;
        case "action.devices.EXECUTE":
          console.log('post /ha EXECUTE');
          /**
           * request:
           * {
           *   "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
           *   "inputs": [{
           *     "intent": "action.devices.EXECUTE",
           *     "payload": {
           *       "commands": [{
           *         "devices": [{
           *           "id": "123",
           *           "customData": {
           *             "fooValue": 12,
           *             "barValue": true,
           *             "bazValue": "alpaca sauce"
           *           }
           *         }, {
           *           "id": "234",
           *           "customData": {
           *              "fooValue": 74,
           *              "barValue": false,
           *              "bazValue": "sheep dip"
           *           }
           *         }],
           *         "execution": [{
           *           "command": "action.devices.commands.OnOff",
           *           "params": {
           *             "on": true
           *           }
           *         }]
           *       }]
           *     }
           *   }]
           * }
           */
          exec({
            uid: uid,
            auth: authToken,
            requestId: reqdata.requestId,
            commands: reqdata.inputs[0].payload.commands
          }, res).then(function(value) {

              let resBody = {
      					requestId: reqdata.requestId,
      					payload: {
      				  	commands: value[0]
      					}
    					};

    					console.log("resBody ", resBody);

    					res.status(200).json(resBody);
						}, function(reason) {
						  console.log(reason)
						});
          break;
        default:
          res.status(401).set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }).json({error: "missing intent"});
          break;
      }
    }
  });
  /**
   * Enables prelight (OPTIONS) requests made cross-domain.
   */
  app.options('/ha', function (req, res) {
    res.status(200).set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }).send('null');
  });

  /**
   *
   * @param data
   * {
   *   "uid": "213456",
   *   "auth": "bearer xxx",
   *   "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf"
   * }
   * @param response
   * @return {{}}
   * {
   *  "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
   *   "payload": {
   *     "devices": [{
   *         "id": "123",
   *         "type": "action.devices.types.Outlet",
   *         "traits": [
   *            "action.devices.traits.OnOff"
   *         ],
   *         "name": {
   *             "defaultNames": ["TP-Link Outlet C110"],
   *             "name": "Homer Simpson Light",
   *             "nicknames": ["wall plug"]
   *         },
   *         "willReportState: false,
   *         "attributes": {
   *         // None defined for these traits yet.
   *         },
   *         "roomHint": "living room",
   *         "config": {
   *           "manufacturer": "tplink",
   *           "model": "c110",
   *           "hwVersion": "3.2",
   *           "swVersion": "11.4"
   *         },
   *         "customData": {
   *           "fooValue": 74,
   *           "barValue": true,
   *           "bazValue": "sheepdip"
   *         }
   *       }, {
   *         "id": "456",
   *         "type": "action.devices.types.Light",
   *         "traits": [
   *           "action.devices.traits.OnOff",
   *           "action.devices.traits.Brightness",
   *           "action.devices.traits.ColorTemperature",
   *           "action.devices.traits.ColorSpectrum"
   *         ],
   *         "name": {
   *           "defaultNames": ["OSRAM bulb A19 color hyperglow"],
   *           "name": "lamp1",
   *           "nicknames": ["reading lamp"]
   *         },
   *         "willReportState: false,
   *         "attributes": {
   *           "TemperatureMinK": 2000,
   *           "TemperatureMaxK": 6500
   *         },
   *         "roomHint": "living room",
   *         "config": {
   *           "manufacturer": "osram",
   *           "model": "hg11",
   *           "hwVersion": "1.2",
   *           "swVersion": "5.4"
   *         },
   *         "customData": {
   *           "fooValue": 12,
   *           "barValue": false,
   *           "bazValue": "dancing alpaca"
   *         }
   *       }, {
   *         "id": "234"
   *         // ...
   *     }]
   *   }
   * }
   */
  function sync(data, res) {
    console.log('query', data);

  	let query = admin.database().ref(`/users/${data.uid}/devices`);

		query.once('value').then(snapshot => {
		    var devices = [];
		    snapshot.forEach(childSnapshot => {
		    	var device = childSnapshot.val()
		    	device.properties['id'] = childSnapshot.key
		      devices.push(device.properties);
		    });
		
				console.log(devices)
 				
 				if (!devices) {
    		  res.status(500).set({
    		    'Access-Control-Allow-Origin': '*',
    		    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    		  }).json({error: "failed"});
    		  return;
    		}

    		let deviceProps = {
    		  requestId: data.requestId,
    		  payload: {
    		  	agentUserId: data.uid,
    		    devices: devices
    		  }
    		};

    	console.log("sync response ", deviceProps);
    		res.status(200).json(deviceProps);
    		return deviceProps;
		});
  }

  /**
   *
   * @param data
   * {
   *   "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
   *   "uid": "213456",
   *   "auth": "bearer xxx",
   *   "devices": [{
   *     "id": "123",
   *       "customData": {
   *         "fooValue": 12,
   *         "barValue": true,
   *         "bazValue": "alpaca sauce"
   *       }
   *   }, {
   *     "id": "234"
   *   }]
   * }
   * @param response
   * @return {{}}
   * {
   *  "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
   *   "payload": {
   *     "devices": {
   *       "123": {
   *         "on": true ,
   *         "online": true
   *       },
   *       "456": {
   *         "on": true,
   *         "online": true,
   *         "brightness": 80,
   *         "color": {
   *           "name": "cerulian",
   *           "spectrumRGB": 31655
   *         }
   *       },
   *       ...
   *     }
   *   }
   * }
   */
  function query(data, res) {
    console.log('query', data);
    let deviceIds = getDeviceIds(data.devices);

    console.log(deviceIds);

    let query = admin.database().ref(`/users/${data.uid}/devices`);

		query.once('value').then(snapshot => {
		  var devices = {};
		  snapshot.forEach(childSnapshot => {
		  	if (deviceIds.indexOf(childSnapshot.key) !== -1) {
		  		var device = childSnapshot.val()
		  		devices[childSnapshot.key] = device.states;
		  	}
		  });
		
				console.log(devices)
 				
 				if (!devices) {
    		  res.status(500).set({
    		    'Access-Control-Allow-Origin': '*',
    		    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    		  }).json({error: "failed"});
    		  return;
    		}

    		let deviceProps = {
    		  requestId: data.requestId,
    		  payload: {
    		  	agentUserId: data.uid,
    		    devices: devices
    		  }
    		};

    	console.log("query response ", deviceProps);
    		res.status(200).json(deviceProps);
    		return deviceProps;
		});
  }

  /**
   *
   * @param devices
   * [{
   *   "id": "123"
   * }, {
   *   "id": "234"
   * }]
   * @return {Array} ["123", "234"]
   */
  function getDeviceIds(devices) {
    let deviceIds = [];
    for (let i = 0; i < devices.length; i++) {
      if (devices[i] && devices[i].id)
        deviceIds.push(devices[i].id);
    }
    return deviceIds;
  }

  /**
   * @param data:
   * {
   *   "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
   *   "uid": "213456",
   *   "auth": "bearer xxx",
   *   "commands": [{
   *     "devices": [{
   *       "id": "123",
   *       "customData": {
   *          "fooValue": 74,
   *          "barValue": false
   *       }
   *     }, {
   *       "id": "456",
   *       "customData": {
   *          "fooValue": 12,
   *          "barValue": true
   *       }
   *     }, {
   *       "id": "987",
   *       "customData": {
   *          "fooValue": 35,
   *          "barValue": false,
   *          "bazValue": "sheep dip"
   *       }
   *     }],
   *     "execution": [{
   *       "command": "action.devices.commands.OnOff",
   *       "params": {
   *           "on": true
   *       }
   *     }]
   *  }
   *
   * @param response
   * @return {{}}
   * {
   *   "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
   *   "payload": {
   *     "commands": [{
   *       "ids": ["123"],
   *       "status": "SUCCESS"
   *       "states": {
   *         "on": true,
   *         "online": true
   *       }
   *     }, {
   *       "ids": ["456"],
   *       "status": "SUCCESS"
   *       "states": {
   *         "on": true,
   *         "online": true
   *       }
   *     }, {
   *       "ids": ["987"],
   *       "status": "OFFLINE",
   *       "states": {
   *         "online": false
   *       }
   *     }]
   *   }
   * }
   */
  function exec(data, res) {
    console.log('exec', data);
    let respCommands = [];
    for (let i = 0; i < data.commands.length; i++) {
      let curCommand = data.commands[i];
      for (let j = 0; j < curCommand.execution.length; j++) {
        let curExec = curCommand.execution[j];
        respCommands.push(execDevices(data.uid, curExec, curCommand.devices));
      }
    }
    return Promise.all(respCommands);
  }

  /**
   *
   * @param uid
   * @param command
   * {
   *   "command": "action.devices.commands.OnOff",
   *   "params": {
   *       "on": true
   *   }
   * }
   * @param devices
   * [{
   *   "id": "123",
   *   "customData": {
   *      "fooValue": 74,
   *      "barValue": false
   *   }
   * }, {
   *   "id": "456",
   *   "customData": {
   *      "fooValue": 12,
   *      "barValue": true
   *   }
   * }, {
   *   "id": "987",
   *   "customData": {
   *      "fooValue": 35,
   *      "barValue": false,
   *      "bazValue": "sheep dip"
   *   }
   * }]
   * @return {Array}
   * [{
   *   "ids": ["123"],
   *   "status": "SUCCESS"
   *   "states": {
   *     "on": true,
   *     "online": true
   *   }
   * }, {
   *   "ids": ["456"],
   *   "status": "SUCCESS"
   *   "states": {
   *     "on": true,
   *     "online": true
   *   }
   * }, {
   *   "ids": ["987"],
   *   "status": "OFFLINE",
   *   "states": {
   *     "online": false
   *   }
   * }]
   */
  function execDevices(uid, command, devices) {
    let payload = [];
    for (let i = 0; i < devices.length; i++) {
      payload.push(execDevice(uid, command, devices[i]));
    }
    return Promise.all(payload);
  }


  /**
   *
   * @param uid
   * @param command
   * {
   *   "command": "action.devices.commands.OnOff",
   *   "params": {
   *       "on": true
   *   }
   * }
   * @param device
   * {
   *   "id": "123",
   *   "customData": {
   *      "fooValue": 74,
   *      "barValue": false
   *   }
   * }
   * @return {{}}
   * {
   *   "ids": ["123"],
   *   "status": "SUCCESS"
   *   "states": {
   *     "on": true,
   *     "online": true
   *   }
   * }
   */
  function execDevice(uid, command, device) {
  	return new Promise(function (resolve, reject) {	
  		console.log("attempt to save ", command.params);
			admin.database().ref(`/users/${uid}/devices`).child(device.id).child('states').update(command.params, function(error) {
  			if (error) {
  			  consloe.log("Data could not be saved." + error);
  			  reject();
  			} else {
  			  admin.database().ref(`/users/${uid}/devices`).child(device.id).once('value').then(snapshot => {
	
						console.log("after saving", snapshot.val());

    				resolve({
    				  ids: [device.id],
    				  status: "SUCCESS",
    				  states: snapshot.val().states
    				});
	
  			  }).catch(error => {
						console.log("error exec device ", device.id, error);
    	  		resolve({
    				  ids: [device.id],
    				  status: "FAILURE",
    				  states: {}
    				});
  				});	
  			}
			});

  	});
  }

module.exports = app