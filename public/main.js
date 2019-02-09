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

function Demo() {
  $(function() {
    this.$setCallbackButton = $('#set-callback-button');
    this.$signInButton = $('#demo-sign-in-button');
    this.$signOutButton = $('#demo-sign-out-button');
    this.$traitOnOff = $('#trait-onoff');
    this.$traitBrightness = $('#trait-brightness');
    this.$traitColorSetting = $('#trait-colorSetting');
    this.$traitTemperatureSetting = $('#trait-temperatureSetting');
    this.$traitScene = $('#trait-scene');
    this.$urlTextInput = $('#url-text-input');
    this.$devicePropertiesTextarea = $('#device-properties');
    this.$deviceStateTextarea = $('#device-state');
    this.$createMessageButton = $('#demo-create-message');
    this.$createMessageResult = $('#demo-create-message-result');
    this.$messageListButtons = $('.message-list-button');
    this.$messageList = $('#demo-message-list');
    this.$messageDetails = $('#demo-message-details');

    this.$signInButton.on('click', this.signIn.bind(this));
    this.$signOutButton.on('click', this.signOut.bind(this));
    this.$createMessageButton.on('click', this.createMessage.bind(this));
    this.$messageListButtons.on('click', this.listMessages.bind(this));
    firebase.auth().onAuthStateChanged(this.onAuthStateChanged.bind(this));
  }.bind(this));
}

Demo.prototype.signIn = function() {
  firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
};

Demo.prototype.signOut = function() {
  firebase.auth().signOut();
};

Demo.prototype.onAuthStateChanged = function(user) {
  if (user) {
    // If we have a user, simulate a click to get all their messages.
    // Material Design Lite will create a <span> child that we'll expect to be clicked
    $('#message-list-button-all > span').click();
    this.$devicePropertiesTextarea.removeAttr('disabled');
    this.$deviceStateTextarea.removeAttr('disabled');
    this.$createMessageButton.removeAttr('disabled');
  } else {
    this.$devicePropertiesTextarea.attr('disabled', true);
    this.$deviceStateTextarea.attr('disabled', true);
    this.$createMessageButton.attr('disabled', true);
    this.$createMessageResult.html('');
    this.$messageList.html('');
    this.$messageDetails.html('');
  }
};

Demo.prototype.createMessage = function() {
  if (!firebase.auth().currentUser) {
    throw new Error('Not authenticated. Make sure you\'re signed in!');
  }

  var uid = firebase.auth().currentUser.uid

  var type = $('input[name=device-type]:checked').val()
  var traits = this.traits();
  var device = this.$devicePropertiesTextarea.val();
  var state = this.$deviceStateTextarea.val();

  if (device === '' || state === '') return;
  device = JSON.parse(device)
  device["traits"] = traits;
  device["type"] = "action.devices.types." + type.toUpperCase();

  var newDeviceKey = firebase.database().ref().child('devices').child(uid).push().key;

  // Write the new post's data simultaneously in the posts list and the user's post list.
  var updates = {};
  updates['/devices/' + uid + '/' + newDeviceKey] = device;
  updates['/states/' + uid + '/' + newDeviceKey] = JSON.parse(state);

  firebase.database().ref().update(updates, function(error) {
    if (error) {
      console.log('Error creating device:', device);
    } else {
      this.$devicePropertiesTextarea.val('');
      this.$deviceStateTextarea.val('');
      this.$devicePropertiesTextarea.parent().removeClass('is-dirty');
      this.$createMessageResult.html('Created device: ' + newDeviceKey);
    }
  }.bind(this));
};

Demo.prototype.traits = function() {
  var traits = []
  if (this.$traitOnOff.is(':checked')) {
    traits.push("action.devices.traits.OnOff")
  }
  if (this.$traitBrightness.is(':checked')) {
    traits.push("action.devices.traits.Brightness")
  }
  if (this.$traitColorSetting.is(':checked')) {
    traits.push("action.devices.traits.ColorSetting")
  }
  if (this.$traitTemperatureSetting.is(':checked')) {
    traits.push("action.devices.traits.TemperatureSetting")
  }
  if (this.$traitScene.is(':checked')) {
    traits.push("action.devices.traits.Scene")
  }
  return traits;
};

Demo.prototype.listMessages = function(event) {
  this.$messageListButtons.removeClass('mdl-button--accent');
  $(event.target).parent().addClass('mdl-button--accent');
  this.$messageList.html('');
  this.$messageDetails.html('');

  var ref = this.authenticatedRef('devices');

  // Optionally specifying a type
  var label = $(event.target).parent().text().toLowerCase();
  var type = label === 'all' ? undefined : label;
  if (type) {
   ref = ref.orderByChild("type").equalTo("action.devices.types." + type.toUpperCase())
  }

  ref.once('value').then(function(snapshot) {
    var elements = []
    snapshot.forEach(function(childSnapshot) {
      var childKey = childSnapshot.key;
      var childData = childSnapshot.val();

      elements.push($('<li>')
        .text(childKey)
        .addClass('mdl-list__item')
        .data('key', childKey)
        .on('click', this.messageDetails.bind(this)))
      // ...
    }.bind(this))

    // Append items to the list and simulate a click to fetch the first message's details
    this.$messageList.append(elements);

    if (elements.length > 0) {
      elements[0].click();
    }

  }.bind(this)).catch((error) => {
    console.log('Error listing devices.');
    throw error;
  })
};

Demo.prototype.messageDetails = function(event) {
  $('li').removeClass('selected');
  $(event.target).addClass('selected');

  var key = $(event.target).data('key');

  this.authenticatedRef('devices').child(key).once('value').then(function(snapshot) {
    this.$messageDetails.text(JSON.stringify(snapshot.val(), null, 2));
  }.bind(this)).catch((error) => {
    console.log('Error getting device details.');
    throw error;
  });
};

Demo.prototype.authenticatedRef = function(ref) {
  if (!firebase.auth().currentUser) {
    throw new Error('Not authenticated. Make sure you\'re signed in!');
  }

  return firebase.database().ref(ref).child(firebase.auth().currentUser.uid)
}

window.demo = new Demo();