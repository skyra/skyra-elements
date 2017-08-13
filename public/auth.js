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
    this.$signInButton = $('#demo-sign-in-button');
    this.$signOutButton = $('#demo-sign-out-button');
    
    this.$signInButton.on('click', this.signIn.bind(this));
    this.$signOutButton.on('click', this.signOut.bind(this));
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
    console.log(user.uid)

    //TODO: store a token to look up this user with?
    window.location = getUrlParameter("redirect_uri") + `#access_token=${user.uid}&token_type=bearer&state=` + getUrlParameter("state");

    // firebase.auth().currentUser.getToken().then(function(token) {
    //   console.log(getUrlParameter("redirect_uri") + `#access_token=${token}&token_type=bearer&state=` + getUrlParameter("state"));
    //   // window.location = getUrlParameter("redirect_uri") + `#access_token=${token}&token_type=bearer&state=` + getUrlParameter("state");
    // });

  }
};

var getUrlParameter = function(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1];
        }
    }
};

window.demo = new Demo();