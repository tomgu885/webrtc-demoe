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

const removeOfferByName = (name) => {
    console.log('removeOfferByName', name, ' |offers.length:', offers.length);

    for (let i = 0, len = offers.length; i < len; i++) {
        if (offers[i].offerUsername === name) {
            offers.splice(i, 1);
            return
        }
    }
}

const removeSocketByName = (username) => {
    for (let i = 0, len = connectedSockets.length; i < len; i++) {
        if (connectedSockets[i].username === username) {
            connectedSockets.splice(connectedSockets.indexOf(username), 1);
            return
        }

    }
}

const socketIdByName = (username) => {
    finded = connectedSockets.find( item =>  item.username === username );
    return finded
}

io.on('connection', socket => {
    console.log('client connected', socket.handshake.auth, 'socket.id:', socket.id);
    const username = socket.handshake.auth.username
    const password = socket.handshake.auth.password

    if (password !== 'x') {
        socket.disconnect(true)
    }

    connectedSockets.push({
        socketId: socket.id,
        username,
    })

    console.log('connectedSockets 92', connectedSockets)

    if (offers.length > 0) {
        socket.emit('availableOffers', offers)
    }

    socket.on('disconnect', () => {
        console.log('client disconnected 111: ', socket.handshake.auth.username)
        const username = socket.handshake.auth.username
        removeSocketByName(username)
        console.log('connectionSocks 102', connectedSockets);

        // console.log('offers', offers);
        removeOfferByName(socket.handshake.auth.username);
        console.log('offer left:', offers.length);
        socket.broadcast.emit('availableOffers', offers)
    })

    socket.on('removeOffer', () => {
        removeOfferByName(socket.handshake.auth.username);
        console.log('offer left:', offers.length);
        socket.broadcast.emit('availableOffers', offers)
    });

    socket.on('newOffer', newOffer => {
        console.log('newOffer audioOnly:', newOffer.audioOnly)
        console.log('newOffer relayOnly:', newOffer.relayOnly)
        offers.push({
            offerUsername: username,
            audioOnly: newOffer.audioOnly,
            relayOnly: newOffer.relayOnly,
            offer: newOffer.offer,
            offerIceCandidates: [],
            answer: null,
            answerUsername: null,
            answerIceCandidates: [],
        })
        console.log('newOffer:', offers.length)
        socket.broadcast.emit('availableOffers', offers)
    })

    socket.on('removeOffer', (thisOffer) => {
        console.log('removeOffer:', thisOffer)
        if (!offers || offers.length === 0 ) {
            console.log('no offers found');
            return
        }

        offers.forEach(( offer) => {

        })
    })

    socket.on('newAnswer', (offerObj, ackFunction) => {
        console.log('newAnswer|offerObj.offerUsername:', offerObj.offerUsername)
        // emit this answer back to client1
        console.log('newAnswer:', offerObj.offerUsername)
        const socketToAnswer = socketIdByName(offerObj.offerUsername) //connectedSockets.find(s => s.username === offerObj.offerUsername)
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
        // offerToUpdate.answer = offerObj.answer
        // offerToUpdate.answerUsername = username

        for (let i = 0, len = offers.length; i < len; i++) {
            if (offers[i].offerUsername === offerObj.offerUsername) {
                offers[i].answer = offerObj.answer
                offers[i].answerUsername = username
                console.log('newAnswer updated', i);
                break
            }
        }

        socket.to(socketIdToAnswer).emit('answerResponse', offerToUpdate)
    }) // socket.on('newAnswer')

    socket.on('endvideo', () => {
        console.log('video disconnect:', username)
        let offer = offers.find(s => s.offerUsername === username)
        // console.log('offer', offer)
        if (offer && offer.answerUsername) {
            socketToEnd = socketIdByName(offer.answerUsername)
            if (socketToEnd) {
                socket.to(socketToEnd.socketId).emit('endvideo')
            }
            removeOfferByName(offer.offerUsername)
            return
        }

        let offer2 = offers.find(s => s.answerUsername === username)
        // console.log('offer2', offer2)
        if (offer2 && offer2.offerUsername) {
            socketToEnd = socketIdByName(offer2.offerUsername)
            if (socketToEnd) {
                socket.to(socketToEnd.socketId).emit('endvideo')
            }
            removeOfferByName(offer2.offerUsername)
        }


        socket.emit('availableOffers', offers)
    })

    socket.on('sendIceCandidateToSignalingServer', iceCandidateObj => {
        const {didIOOffer, iceUsername, iceCandidate } = iceCandidateObj;
        console.log('--------= sendIceCandidateToSignalingServer ==---------');
        console.log('iceUsername:', iceUsername, '|didIOOffer:', didIOOffer);
        if (didIOOffer) { // 发起者
            const offerInOffers = offers.find(s => s.offerUsername === iceUsername);
            if (!offerInOffers) {
                console.log('offer not found.')
                return
            }
            // console.log('true offerInOffers:', offerInOffers)
            offerInOffers.offerIceCandidates.push(iceCandidate)
            console.log('offerInOffers.answerUsername 1:', offerInOffers.answerUsername)
            if (offerInOffers.answerUsername) {
                // pass it throught to the other sockets
                const socketToSendTo = socketIdByName(offerInOffers.answerUsername) //connectedSockets.find(s => s.username === iceUsername)
                if (!socketToSendTo) {
                    console.log('offer not found. 169')
                    return
                }
                console.log('answerUsername.socketToSendTo', socketToSendTo)
                if (socketToSendTo) {
                    socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate);
                } //
                // else no answer
            }

        } else { // !didOffer
            const offerInOffers = offers.find(s => s.answerUsername === iceUsername);
            if (!offerInOffers) {
                console.log('offerInOffers not found.2')
                return;
            }
            console.log('offerInOffers.offerUsername:',offerInOffers.offerUsername)
            socketToSendTo = socketIdByName(offerInOffers.offerUsername) //connectedSockets.find(s => s.username === iceUsername);
            if (!socketToSendTo) {
                console.log('socketToSendTo not found.3');
                return;
            }

            console.log('sending|receivedIceCandidateFromServer:', socketToSendTo);
            socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate);
        }
    }); // sendIceCandidateToSignalingServer
})