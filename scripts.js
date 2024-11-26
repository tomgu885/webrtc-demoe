const username = 'Robby-'+Math.floor(Math.random()*100000)
const password = 'x'
document.querySelector('#user-name').innerHTML = username

console.log('start...');
const socket = io.connect('https://192.168.10.145:8443', {
    auth: {
        username, password,
    }
})

const localVideoEl = document.querySelector('#local-video');
const remoteVideoEl = document.querySelector('#remote-video');

let localStream; // a var to hold the local video stream
let remoteStream; // to hold remote video stream
let peerConnection;// the peerConnection taht two client use to talk
let didIOOffer = false;

let peerConfiguration = {
    iceServers: [
        {
            urls:[
                'stun:stun.yy.com',
                'stun:stun.chat.bilibili.com',
                'stun:stun.miwifi.com',
            ]
        }
    ]
}

const call = async (evt) => {
    await fetchUserMedia();
    await createPeerConnection();
    try {
        console.log('create offer');
        const offer = await peerConnection.createOffer();
        console.log('offer', offer);
        peerConnection.setLocalDescription(offer);
        didIOOffer = true;
        socket.emit('newOffer', offer);;
    } catch (err) {
        console.error(err);
    }
}

const answerOffer = async (offerObj) => {
    console.log('answerOffer offerObj', offerObj);
    await fetchUserMedia();
    await createPeerConnection(offerObj);
    const answer = await peerConnection.createAnswer({});
    await peerConnection.setLocalDescription(answer);
    offerObj.answer = answer;
    const offerIceCandidate = await socket.emitWithAck('newAnswer', offerObj);
    offerIceCandidate.forEach(c => {
        peerConnection.addIceCandidate(c);
        console.log('add ice candidate', c);
    });
}

const addAnswer = async (offerObj) => {
    await peerConnection.setRemoteDescription(offerObj.answer);
}

const fetchUserMedia = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                // audio: true,
            })
            localVideoEl.srcObject = stream;
            localStream = stream;
            resolve()
        } catch (err) {
            console.log('fetchUserMedia failed.err:', err)
            reject()
        }
    })
}

const createPeerConnection = (offerObj) => {
    return new Promise(async (resolve, reject) => {
        peerConnection = await new RTCPeerConnection(peerConfiguration)
        remoteStream = new MediaStream();
        remoteVideoEl.srcObject = remoteStream;

        localStream.getTracks().forEach(track => {
            // add local track
            console.warn('add track')
            peerConnection.addTrack(track);
        })

        peerConnection.addEventListener('signalingstatechange', (event) => {
            console.log('signalingstatechange', event);
            console.log('signaling statechange', peerConnection.signalingState);
        });

        peerConnection.addEventListener('icecandidate', (event) => {
            console.log('peerConnection.on(icecandidate) found', event);
            if (event.candidate) {
                socket.emit('sendIceCandidateToSignalingServer', {
                    iceCandidate: event.candidate,
                    iceUsername: username,
                    didIOOffer,
                })
            }
        }); // icecandidate

        peerConnection.addEventListener('track', (event) => {
            console.log('get track from another peer', event);
            console.log('get track from another peer', event.streams);
            event.streams[0].getTracks().forEach(track => {
                console.log('add remote track');
                remoteStream.adddTrack(track);
            });
        }) // track

        if (offerObj) {
            await peerConnection.setRemoteDescription(offerObj.offer);
        }

        resolve()
    });
}

const addNewIceCandidate = (iceCandidate) => {
    if (!peerConnection) {
        console.log('addNewIceCandidate, peerConnection not initialized');
        return;
    }
    peerConnection.addIceCandidate(iceCandidate);
    console.log('addNewIceCandidate candidate', iceCandidate);
}

document.querySelector('#call').addEventListener('click', call);