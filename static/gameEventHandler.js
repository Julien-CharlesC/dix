
function processServer(data){
  action = data.action
  showTurn(data)
  switch (action){

    case "playerChange":
      updateNames(data)
      break

    case "invalid":
      console.log(data.msg)
      break

    case "bid":
      updateBid(data)
      if (data.bids.filter(x => x === 0).length === 3 ){
        clearTableTimeout = setTimeout(() => {
          updateTableCenter(data.center, data)
          clearTableTimeout = null
        }, 4000);
      }
      break

    case "cardPlayed":
      if (audioOn) cardPlayedSound.play()
      showTrump(data)
      playCard(data)
      if (data.state ==="end"){
        updatePoints(data)
        updateHistory(data)
      }
      break

    case "newHand":
      let next_bid = 50
      if (audioOn){shuffleSound.play()}
      updatePage(data)
      break

    case "update":
      updatePage(data)
      break
  }
}

function updateScriptState(data){
  mySeat = data.mySeat
  turn = data.turn
  const myName =  data.players[mySeat].name
  localStorage.setItem("playerName", myName)
}

function updatePage(data){
  if (data.state == "biding"){
    updateBid(data)
  } else if(!lastTrickIsShown) {
    updateTableCenter(data.center, data)
    updateBidWinner(data)
  }
  updateURL(data)
  deleteMovingCards()
  updateRoomId(data)
  showTrump(data)
  updatePoints(data)
  updateNames(data)
  renderMyHand(data)
  renderOtherPlayerHands(data)
  showTurn(data)
  player2 = document.getElementById("player2")
  lockHeight(player2)
  updateHistory(data)
}