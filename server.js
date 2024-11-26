const fs = require('fs')
const https = require('https')
const express = require('express')

const app = express()

const socketio = require('socket.io')
app.use(express.static(__dirname))

// mkcert create-ca
// mkcert create-cert
const key = fs.readFileSync('cert.key');
const cert =fs.readFileSync('cert.crt');
console.log('read cert and key!')
const expressServer = https.createServer({key, cert} ,app)

const io = socketio(expressServer, {
    cors: {
        origin: '*',
    },
    methods: ['GET', 'POST'],
})

expressServer.listen(8443, (token) => {
    console.log('listening...', token);
});

const offers = [
    // offerUsername
    // offer
    // offerIceCandidates, [ice = interactive connectivity establishment]
    // answerUsername
    // answer
    // answerIceCandidates
];

const connectedSockets = [
    // username, socketID
]

io.on('connection', socket => {
    console.log('client connected', socket.handshake.auth);
    const username = socket.handshake.auth.username
    const password = socket.handshake.auth.password

    if (password !== 'x') {
        socket.disconnect(true)
    }

    connectedSockets.push({
        username: username,
        socketId: socket.id
    })

    if (offers.length > 0) {
        socket.emit('availableOffers', offers)
    }

    socket.on('newOffer', newOffer => {
        offers.push({
            offerUsername: username,
            offer: newOffer,
            offerIceCandidates: [],
            answer: null,
            answerUsername: null,
            answerIceCandidates: [],
        })

        socket.broadcast.emit('newOfferAwaiting', offers.slice(-1))
    })

    socket.on('newAnswer', (offerObj, ackFunction) => {
        console.log('offerObj:', offerObj)
        // emit this answer back to client1
        const socketToAnswer = connectedSockets.find(s => {
            s.username === offerObj.username
        })

        if (!socketToAnswer) {
            console.log('no matching socket')
            return;
        }

        const socketIdToAnswer = socketToAnswer.socketId
        const offerToUpdate = offers.find(s => s.username === offerObj.username)
        if (!offerToUpdate) {
            console.log('no offer to update')
            return;
        }

        ackFunction(offerToUpdate.offerIceCandidate)
        offerToUpdate.answer = offerObj.answer
        offerToUpdate.answerUsername = username

        socket.to(socketIdToAnswer).emit('answerResponse', offerToUpdate)
    }) // newAnswer

    socket.on('sendIceCandidateToSignalingServer', iceCandidateObj => {
        const {didIOOffer, iceUsername, iceCandidate } = iceCandidateObj;
        console.log('signaling: offers:', offers)
        if (didIOOffer) {
            const offerInOffers = offers.find(s => s.username === iceUsername);
            if (!offerInOffers) {
                return
            }

            offerInOffers.offerIceCandidates.push(iceCandidate)
            if (offerInOffers.answerUsername) {
                // pass it throught to the other sockets
                const socketToSendTo = connectedSockets.find(s => s.username === iceUsername)
                if (socketToSendTo) {
                    socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate);
                } //
                // else no answer
            }

        } else { // !didOffer
            const offerInOffers = offers.find(s => s.answerUsername === iceUsername);
            if (!offerInOffers) {
                return;
            }

            socketToSendTo = connectedSockets.find(s => s.username === iceUsername);
            if (!socketToSendTo) {
                return;
            }

            socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate);

        }
    }); // sendIceCandidateToSignalingServer
})