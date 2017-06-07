var apiKey = 'ce16d9aa-4119-4097-a8a5-3a5016c6a81c';
var token = Math.random().toString(36).substr(2);
var socket, pc, myId, devices, deviceIdx = 0;
fetch(`https://skyway.io/${apiKey}/id?ts=${Date.now()}${Math.random()}`).then(res => res.text()).then(id => {
  myIdDisp.textContent = myId = id;
  socket = new WebSocket(`wss://skyway.io/peerjs?key=${apiKey}&id=${myId}&token=${token}`);
  socketSetup(socket);

  navigator.mediaDevices.enumerateDevices().then(devs => {
    var videoDevices = devs.filter(device => device.kind === 'videoinput');
    if (videoDevices.length > 0) {
      devices = videoDevices;
      btnAddStream.style.display = '';
    }
  })
});

btnAddStream.onclick = evt => {
  if (!pc) pcSetup(callTo.value);
  addStream({ deviceId: devices[deviceIdx].deviceId});
  deviceIdx++;
  if (deviceidx === devices.length) {
    btnAddStream.style.display = 'none';
  }
}

function addStream(video = false, audio = false) {
  navigator.mediaDevices.getUserMedia({ video, audio }).then(stream => {
    var vid = document.createElement('video');
    vid.onloadedmetadata = evt => {
      vid.style.width = (vid.videoWidth / vid.videoHeight * 160) + 'px';
      vid.style.height = '160px';
      vid.play();
      selfViewContainer.appendChild(vid);
    }
    vid.srcObject = stream;
    if(pc.addStream) {
      pc.addStream(stream);
    } else {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }
  });
}

function socketSetup() {
  socket.onopen = function () {
    console.log('socket on open');
  }
  socket.onmessage = function (evt) {
    var msg = JSON.parse(evt.data);
    console.log('msg', JSON.stringify(msg));
    if (!pc && msg.src) {
      console.log('pcSetup', 'remoteId:' + msg.src, msg);
      pcSetup(msg.src);
    }
    if (msg.type === 'OFFER') {
      console.log('%cRecieve offer', 'color: red', msg.ofr);
      pc.setRemoteDescription(new RTCSessionDescription(msg.ofr))
        .then(_ => {
          console.log('%cCreate answer', 'color: red');
          return pc.createAnswer();
        })
        .then(answer => {
          console.log('%csetLocalDescription(answer)', 'color: red', answer);
          return pc.setLocalDescription(answer);
        })
        .then(_ => {
          console.log('%cSend answer', 'color: red', 'dst:' + pc.remoteId, pc.localDescription);
          socket.send(JSON.stringify({
            type: 'ANSWER',
            ans: pc.localDescription,
            dst: pc.remoteId
          }));
        })
        .catch(ex => {
          console.log('Recieve Offer error.', ex);
        });
    } else if (msg.type === 'ANSWER') {
      console.log('%cRecieve answer', msg.ans);
      pc.setRemoteDescription(new RTCSessionDescription(msg.ans))
        .catch(ex => {
          console.log('Recieve Answer error.', ex);
        });
    } else if (msg.type === 'CANDIDATE' && msg.cnd) {
      console.log('%cRecieve candidate', 'color: red', msg.cnd);
      pc.addIceCandidate(new RTCIceCandidate(msg.cnd))
        .catch(ex => {
          console.log('Recieve Candidate error.', ex);
        });
    } else if (msg.type === 'PING') {
      socket.send(JSON.stringify({ type: 'PONG' }));
    }
  }
}

function pcSetup(remoteId) {
  pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.skyway.io:3478' }] });
  pc.remoteId = remoteId;
  pc.onicecandidate = function (evt) {
    console.log('%cpc onicecandidate', 'background: #79b74a; font-weight: bold; padding: 1px;');
    socket.send(JSON.stringify({
      type: 'CANDIDATE',
      cnd: evt.candidate,
      dst: this.remoteId
    }));
  }
  pc.onnegotiationneeded = function (evt) {
    console.log('%cpc onnegotiationneeded', 'background: #5d76a7; color: white; font-weight: bold; padding: 1px;');
    var that = this;
    that.createOffer()
      .then(offer => {
        return that.setLocalDescription(offer);
      })
      .then(_ => {
        socket.send(JSON.stringify({
          type: 'OFFER',
          ofr: pc.localDescription,
          dst: that.remoteId
        }));
      });
  }
  pc.onaddstream = function (evt) {
    console.log('%cpc onaddstream', 'background: #ea4335, font-weight: bold; padding: 1px;');
    remoteView.srcObject = evt.stream;
  }
}
