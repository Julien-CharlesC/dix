
// Return the card html el that correspond
function findMyCard(strSuite,strRank){
  myHand = document.getElementById("player0-hand")
  myCard = Array.from(myHand.children).find((child)=>{
    return (child.classList.contains(strSuite) && 
            child.classList.contains(strRank))
  })
  return myCard
}

// translate player seat (absolute position from the server state) 
// to its number ID in the html relative order to each player
function seat2Id(playerSeat){
  return (playerSeat - mySeat + 4)%4
}

// opposite of seat2Id
function id2Seat(id){
  return (mySeat + id)%4
}

// Return the html rectangle object parameters from an html Id
function getRect(id){ 
  const rect = document.getElementById(id).getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    right: rect.right,
    width: rect.width,
    height: rect.height
  }
}

// translate card name (club five) to its int equivalent for the server
function card2Int(cardEl){
  card = [null,null]
  cardEl.classList.forEach(className => {

    index = cardSuite.indexOf(className)
    if (index!==-1) card[0] = index

    index = cardRank.indexOf(className)
    if (index!==-1) card[1] = index+5
  });
  return card
}

window.addEventListener("resize", () => {
  if (window.innerWidth >= 750) {
    // When the screen is over 750 width, no "confirm" selectedCard shenanigan
    removeAllSelectedCard()
    selectedCard = null
  }
  // Don't want the grid space to disapear when the last card is played.
  player2 = document.getElementById("player2")
  lockHeight(player2)
});