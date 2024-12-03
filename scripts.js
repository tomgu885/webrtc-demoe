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
    socket.emit('ready22')
    socket.on('hello', (username) => {
        console.log('ready$....', username);
    })

    socket.on('ping', () => {
        console.log('ping... from server');
    })

    socket.on('availableOffers', offers => {
        console.log('availableOffers', offers);
        createOfferEls(offers, username);
    })

    socket.on('answerResponse', async (offerObj) => { // 呼叫者
        console.log('answerResponse:', offerObj);
        console.log('addAnswer answer:', offerObj.answer)
        await peerConnection.setRemoteDescription(offerObj.answer);
    });

    socket.on('receivedIceCandidateFromServer', iceCandidate => {
        console.warn('receivedIceCandidateFromServer', iceCandidate);
        // addNewIceCandidate(iceCandidate);
        peerConnection.addIceCandidate(iceCandidate);
    })

    socket.on('endvideo', () => {
        reset(false)
    })

    const localVideoEl = document.querySelector('#local-video');
    const remoteVideoEl = document.querySelector('#remote-video');
    let localStream; // a var to hold the local video stream
    let remoteStream; // to hold remote video stream
    let peerConnection;// the peerConnection taht two client use to talk
    let didIOOffer = false;
    let state = 'ready'; // ready , calling, talking

    let peerConfiguration = {
        iceTransportPolicy: 'all', // all (default), public , relay
        iceServers: [
            {
                urls:[
            //         'stun:stun.yy.com:19302',
                    'stun:stun.chat.bilibili.com:3478',
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

    function createOfferEls(offers, myUsername) {
        const answerEl = document.querySelector('#answer');
        answerEl.innerHTML = '';
        offers.forEach(offer => {
            if (offer.offerUsername === myUsername) {
                return
            }
            console.log('offer', offer);
            const newOfferEl = document.createElement('div');
            let text = `Answer ${offer.offerUsername}`;

            if (offer.audioOnly) {
                text += ':a'
            }

            newOfferEl.innerHTML = `<button class="btn btn-success">${text}</button>`
            newOfferEl.addEventListener('click', (evt) => answerOffer(evt, offer));
            answerEl.appendChild(newOfferEl);
        })
    } // createOfferEls

    const fetchUserMedia = () => {
        localStream = null;
        let conf = {
            video: true,
            audio: true,
        }

        if ($('#audio_only').is(':checked')) {
            conf.video =false;
        }
        console.log('getUserMedia conf.video:', conf.video);
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
    }// fetchUserMedia

    const createPeerConnection = (offerObj) => {
        return new Promise(async (resolve, reject) => {
            if ($('#relay_only').is(':checked')) {
                peerConfiguration.iceTransportPolicy = 'relay'
            } else {
                peerConfiguration.iceTransportPolicy = 'all'
            }
            peerConnection = await new RTCPeerConnection(peerConfiguration)
            remoteStream = new MediaStream();
            remoteVideoEl.srcObject = remoteStream;

            localStream.getTracks().forEach(track => {
                // add local track
                console.warn('add local track to peerConnection:.')
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
                state = 'closed';
                console.log('closed by other peer.')
                reset();
            })

            peerConnection.addEventListener('icecandidate', (event) => {
                let relayOnly = $('#relay_only').is(':checked');
                // if (event.candidate === null) {
                //     console.log('icecandidate null');
                //     return
                // }

                let isRelay = event.candidate && event.candidate.candidate.indexOf('relay') === -1
                console.log('peerConnection.on(icecandidate) found', event.candidate ,' |isRelay:', isRelay);
                // if (event.candidate.candidate.indexOf('relay') === -1) {
                //     return
                // }

                // if (!isRelay && relayOnly) {
                //     console.log('icecandidate relay only.');
                //     return
                // }

                // console.log('peerConnection.on(icecandidate)', event.candidate.candidate);

                if (event.candidate) {
                    socket.emit('sendIceCandidateToSignalingServer', {
                        iceCandidate: event.candidate,
                        iceUsername: username,
                        didIOOffer,
                    })
                }
            }); // icecandidate

            console.log('add on track event');
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
                console.log('setRemoteDescriptionOffer11', offerObj.offer)
                // Uncaught (in promise) OperationError: Failed to execute 'setRemoteDescription' on 'RTCPeerConnection': Failed to parse SessionDescription.
                //     at scripts.js:183:38
                await peerConnection.setRemoteDescription(offerObj.offer);
            }

            resolve()
        });
    } // createPeerConnection

    const addNewIceCandidate = (iceCandidate) => {
        console.warn('addNewIceCandidate', iceCandidate);
        // if (!peerConnection) {
        //     console.log('addNewIceCandidate, peerConnection not initialized');
        //     return;
        // }
        // if (iceCandidate.iceCandidate)
        peerConnection.addIceCandidate(iceCandidate);
        // console.log('addNewIceCandidate candidate', iceCandidate);
    }

    function reset(signaling) {
        if (peerConnection) {
            peerConnection.close();
        } else {
            console.log('peerConnection not opening.')
        }

        if (signaling) {
            socket.emit('endvideo');
        }

        localStream.getTracks().forEach((track) => {track.stop();});
        remoteStream.getTracks().forEach((track) => {track.stop();});
        localVideoEl.srcObject = null;
        remoteVideoEl.srcObject = null;
    }

    $('#call').click(async function (){
        if (this.innerHTML === 'calling') {
            console.log('in calling...');
            return
        }
        let audioOnly = $('#audio_only').is(':checked')
        console.log('calling.')
        await fetchUserMedia();
        await createPeerConnection();
        try {
            console.log('create offer');
            const offer = await peerConnection.createOffer();
            console.log('call.offer', offer);
            await peerConnection.setLocalDescription(offer);
            didIOOffer = true;
            socket.emit('newOffer', {'offer':offer, 'audioOnly':audioOnly, 'relayOnly': $('#relay_only').is(':checked')});
        } catch (err) {
            console.error(err);
        }

        document.querySelector('#hangup').disabled = false;
        state = 'calling';
        this.innerHTML = 'calling';
    });

    const answerOffer = async (evt, offerObj) => {
        console.log('evt', evt)
        $(evt.target).prop('disabled', true);
        console.log('answerOffer offerObj.offerUsername', offerObj.offerUsername, ' |offerObj.audioOnly:' ,offerObj.audioOnly, ' |offerObj.relayOnly:' ,offerObj.relayOnly);
        console.log('answerOffer ans:', offerObj.answer, ' candidate:', offerObj.offerIceCandidates);
        $('#audio_only').prop('checked', !!offerObj.audioOnly);
        $('#relay_only').prop('checked', !!offerObj.relayOnly);


        await fetchUserMedia();
        console.log('after get media')
        await createPeerConnection(offerObj);
        const answer = await peerConnection.createAnswer({});
        await peerConnection.setLocalDescription(answer);
        offerObj.answer = answer;
        const offerIceCandidates = await socket.emitWithAck('newAnswer', offerObj);
        console.log('newAnswer|offerIceCandidates', offerIceCandidates);
        offerIceCandidates.forEach(c => {
            peerConnection.addIceCandidate(c);
            console.log('add ice candidate', c);
        });

        $('#hangup').removeAttr('disabled')
    }

    $('#hangup').click(function (){
        console.log('hangup');
        if ('calling' === state) {
            socket.emit('removeOffer');
        }

        $('#call').html('call');
        reset(true);
    });
});





