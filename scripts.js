jQuery(function ($){
    console.log('ready.$', $);
    const username = 'Robby-'+Math.floor(Math.random()*100000)
    const password = 'x'
    document.querySelector('#user-name').innerHTML = username

    console.log('start...');
// const ws = 'https://webrtc-demo.dk-chat.com/';
    const wsUrl = 'https://localhost:8444/';

    const wsUrl2 = 'https://'+window.location.host+'/'
    console.log('wsUrl2:', wsUrl2)
    const socket = io.connect(wsUrl2, {
        auth: {
            username, password,
        }
    });
    socket.on('connect', () => {
        console.log('connected....');
    })

    socket.on('availableOffers', offers => {
        console.log('availableOffers', offers);
        console.log('availableOffers', offers);
        createOfferEls(offers);
    })

    socket.on('newOfferAwaiting', offers => {
        console.log('newOfferAwaiting', offers);
        createOfferEls(offers);
    });

    socket.on('answerResponse', offerObj => {
        console.log('answerResponse:', offerObj);
        addAnswer(offerObj);
    })

    socket.on('receivedIceCandidateFromServer', iceCandidate => {
        console.log('receivedIceCandidateFromServer', iceCandidate);
        addNewIceCandidate(iceCandidate);
    })

    const localVideoEl = document.querySelector('#local-video');
    const remoteVideoEl = document.querySelector('#remote-video');
    let localStream; // a var to hold the local video stream
    let remoteStream; // to hold remote video stream
    let peerConnection;// the peerConnection taht two client use to talk
    let didIOOffer = false;
    let state = 'ready'; // ready , calling, talking

    let peerConfiguration = {
        iceTransportPolicy: 'relay', // all (default), public , relay
        iceServers: [
            {
                urls:[
            //         'stun:stun.yy.com:19302',
            //         'stun:stun.chat.bilibili.com:19302',
                    'stun:stun.miwifi.com:3478',
                ]
            },
            {
                urls: 'turn:23.248.245.197:3478?transport=udp',
                // 'turn:175.27.245.108:3478?transport=udp',
                credential: 'Pass@123', // password
                username: 'coturn', // username
            }
        ]
    }



    const answerOffer = async (offerObj) => {
        console.log('answerOffer offerObj.offerUsername', offerObj.offerUsername);
        await fetchUserMedia();
        await createPeerConnection(offerObj);
        const answer = await peerConnection.createAnswer({});
        await peerConnection.setLocalDescription(answer);
        offerObj.answer = answer;
        const offerIceCandidates = await socket.emitWithAck('newAnswer', offerObj);
        console.log('offerIceCandidates', offerIceCandidates);
        offerIceCandidates.forEach(c => {
            peerConnection.addIceCandidate(c);
            console.log('add ice candidate', c);
        });
    }

    const addAnswer = async (offerObj) => {
        console.log('addAnswer:', offerObj)
        await peerConnection.setRemoteDescription(offerObj.answer);
    }

    const fetchUserMedia = () => {
        localStream = null;
        let conf = {
            video: true,
            audio: true,
        }

        if ($('#audio_only').is(':checked')) {
            conf.video =false;
        }

        return new Promise(async (resolve, reject) => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia(conf)
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
                if (peerConnection.signalingState === "stable") {
                    console.info('signalingState|stable')
                }
            });

            peerConnection.addEventListener('close', () => {
                console.log('closed by other peer.')
            })

            peerConnection.addEventListener('icecandidate', (event) => {
                if (event.candidate === null) {
                    console.log('icecandidate nulll');
                    return
                }
                console.log('peerConnection.on(icecandidate) found', event.candidate);
                if (event.candidate.candidate.indexOf('relay') === -1) {
                    return
                }

                console.warn('peerConnection.on(icecandidate) relay', event.candidate.candidate);

                if (event.candidate) {
                    socket.emit('sendIceCandidateToSignalingServer', {
                        iceCandidate: event.candidate,
                        iceUsername: username,
                        didIOOffer,
                    })
                }
            }); // icecandidate

            peerConnection.addEventListener('track', (event) => {
                console.warn('track')
                console.warn('get track from another peer', event);
                console.log('get track from another peer stream', event.streams);
                remoteStream.addTrack(event.track)
                // event.streams[0].getTracks().forEach(track => {
                //     console.log('add remote track');
                //     remoteStream.adddTrack(track);
                // });
            }) // track

            if (offerObj) {
                await peerConnection.setRemoteDescription(offerObj.offer);
            }

            resolve()
        });
    }

    const addNewIceCandidate = (iceCandidate) => {
        console.warn('addNewIceCandidate');
        // if (!peerConnection) {
        //     console.log('addNewIceCandidate, peerConnection not initialized');
        //     return;
        // }
        // if (iceCandidate.iceCandidate)
        peerConnection.addIceCandidate(iceCandidate);
        // console.log('addNewIceCandidate candidate', iceCandidate);
    }

    function reset() {
        if (peerConnection) {
            peerConnection.close();
        } else {
            console.log('peerConnection not opening.')
        }
        socket.emit('endvideo');
        localStream.getTracks().forEach((track) => {track.stop();});
        remoteStream.getTracks().forEach((track) => {track.stop();});
    }

    $('#call').click(async function (){
        console.log('calling.')
        await fetchUserMedia();
        await createPeerConnection();
        try {
            console.log('create offer');
            const offer = await peerConnection.createOffer();
            console.log('call.offer', offer);
            await peerConnection.setLocalDescription(offer);
            didIOOffer = true;
            socket.emit('newOffer', offer);
        } catch (err) {
            console.error(err);
        }

        console.log('create offer');
        document.querySelector('#hangup').disabled = false;
        state = 'calling';
    });
    $('#hangup').click(function (){
        if ('calling' === state) {
            socket.emit('removeOffer');
        }

        reset();
    });
});

function createOfferEls(offers) {
    const answerEl = document.querySelector('#answer');
    answerEl.innerHTML = '';
    offers.forEach(offer => {
        console.log('offer', offer);
        const newOfferEl = document.createElement('div');
        newOfferEl.innerHTML = `<button class="btn btn-success col-1">Answer ${offer.offerUsername}</button>`
        newOfferEl.addEventListener('click', () => answerOffer(offer));
        answerEl.appendChild(newOfferEl);
    })
}



