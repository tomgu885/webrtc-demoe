const fs = require('fs')
const https = require('https')
const http = require('http')
const express = require('express')

const app = express()

const socketio = require('socket.io')
app.use(express.static(__dirname))

// mkcert create-ca
// mkcert create-cert
let useHttps = process.env.HTTPS
console.log('useHttps', useHttps);
let expressServer
if ( useHttps === 'true') {
    console.log('read cert and key!')
    const key = fs.readFileSync('cert.key');
    const cert =fs.readFileSync('cert.crt');
    expressServer = https.createServer({key, cert} ,app)
} else {
    expressServer = http.createServer(app)
}


const io = socketio(expressServer, {
    cors: {
        origin: '*',
    },
    methods: ['GET', 'POST'],
})
let port = process.env.PORT || 3000;
console.log('port:', port)
expressServer.listen(port, () => {
    console.log('listening...: ', port);
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
        socketId: socket.id,
        username,
    })
    console.log('client connected:', connectedSockets.length);
    if (offers.length > 0) {
        socket.emit('availableOffers', offers)
    }

    socket.on('disconnect', () => {
        const username = socket.handshake.auth.username
        for (let i = 0, l = connectedSockets.length; i < l; i++) {
            if (connectedSockets[i].username === username) {
                connectedSockets.splice(i, 1)
                break
            }
        }
        console.log('client disconnected', connectedSockets.length);

        // console.log('offers', offers);
        for (let i = 0, l = offers.length; i < l;i++) {
            if (offers[i] && username === offers[i].offerUsername) {
                offers.splice(i, 1)
                break
            }
        }
        console.log('offer left', offers.length);
        socket.broadcast.emit('availableOffers', offers)
    })

    socket.on('newOffer', newOffer => {
        offers.push({
            offerUsername: username,
            offer: newOffer,
            offerIceCandidates: [],
            answer: null,
            answerUsername: null,
            answerIceCandidates: [],
        })
        console.log('newOffer:', offers.length)
        socket.broadcast.emit('newOfferAwaiting', offers.slice(-1))
    })

    socket.on('removeOffer', () => {
        offers.forEach()
    })

    socket.on('newAnswer', (offerObj, ackFunction) => {
        console.log('newAnswer|offerObj.offerUsername:', offerObj.offerUsername)
        // emit this answer back to client1
        const socketToAnswer = connectedSockets.find(s => s.username === offerObj.offerUsername)
        console.log('socketToAnswer', socketToAnswer)
        if (!socketToAnswer) {
            console.log('no matching socket')
            return;
        }

        const socketIdToAnswer = socketToAnswer.socketId
        const offerToUpdate = offers.find(s => s.offerUsername === offerObj.offerUsername)
        if (!offerToUpdate) {
            console.log('no offer to update')
            return;
        }

        ackFunction(offerToUpdate.offerIceCandidates)
        offerToUpdate.answer = offerObj.answer
        offerToUpdate.answerUsername = username

        socket.to(socketIdToAnswer).emit('answerResponse', offerToUpdate)
    }) // socket.on('newAnswer')

    socket.on('sendIceCandidateToSignalingServer', iceCandidateObj => {
        const {didIOOffer, iceUsername, iceCandidate } = iceCandidateObj;

        if (didIOOffer) {
            const offerInOffers = offers.find(s => s.offerUsername === iceUsername);
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