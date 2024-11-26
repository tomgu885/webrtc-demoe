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
    addAnswer(offerObj);
})

socket.on('receivedIceCandidateFromServer', iceCandidate => {
    console.log('receivedIceCandidateFromServer', iceCandidate);
    addNewIceCandidate(iceCandidate);
})


function createOfferEls(offers) {
    const answerEl = document.querySelector('#answer');
    offers.forEach(offer => {
        console.log('offer', offer);
        const newOfferEl = document.createElement('div');
        newOfferEl.innerHTML = `<button class="btn btn-success col-1">Answer ${offer.offerUsername}</button>`
        newOfferEl.addEventListener('click', () => answerOffer(offer));
        answerEl.appendChild(newOfferEl);
    })
}