let mySeat
let clearTableTimeout = null
let cardPlayedSound = new Audio("/audio/cardPlayed.mp3")
let shuffleSound = new Audio("/audio/shuffle.mp3")

function dev(){
  socket.send("bid:0")
}
function createNewRoom(name){
    token = "newRoom:"+name
    connect(token)
    closeDialog('createNewRoomDialog')
}
function openDialog(dialogId, truc=""){
  const dialog = document.getElementById(dialogId)
  dialog.showModal()
  if (truc){
    dialog.querySelector("h2").innerHTML = truc
  }
  dialog.addEventListener("close", () => {
    document.body.style.filter = "none"
  }, { once: true }) // Only once per open
  document.body.style.filter = "blur(5px)"
}
function closeDialog(dialogId){
  document.getElementById(dialogId).close()
  document.body.style.filter = "none"
}

function joinRoom(name,roomId){
  token = "joinRoom:"+name + "," + roomId
  connect(token)
  closeDialog('createNewRoomDialog')
}

function connect(token){

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host 
  const wsUrl = `${protocol}://${host}/ws?token=` + token

  fetch("http://"+host+'/validateConnectionToken?token='+token)
  .then(async response=>{
  if (!response.ok){
    if (response.status === 404){
      openDialog('errorDialog',"Erreur du serveur.")
    }else{
      errorObj = await response.json()
      errorMsg = errorObj.detail
      openDialog('errorDialog', errorMsg)
    }
  }else{

    socket = new WebSocket(wsUrl)

    socket.onopen = () => { 
      console.log("Connected to:", wsUrl); 
      document.getElementById("game-container").style.display = "flex"
      document.getElementById("header-buttons").style.display = "flex"
      document.getElementById("home-container").style.display = "none"
      header = document.getElementById("header").classList.add("game-header")
    }

    socket.onmessage = (event) => {
        data = event.data
        console.log("Message from server:", event.data);
        processServer(JSON.parse(data))
    }
    socket.onerror = (event) =>{
        console.log(event)
    }
    socket.onclose = (event) => {
        console.log("Socket closed.")
        document.getElementById("home-container").style.display = "block"
        document.getElementById("game-container").style.display = "None"
        document.getElementById("header-buttons").style.display = "none"
        header = document.getElementById("header").classList.remove("game-header")
    }
  }})
  .catch((error)=>{
    openDialog('errorDialog',"Erreur de connection au serveur.")
  }
  )
}
/*
function refreshCenter(){
  for(let i=0;i<=3;i++){
    id = "table-center-card"+i
    playerHand = document.getElementById(id)
    playerHand.className="card placeholder" 
  }
}

// replace other players card with place-holder
function refreshPlayers(seatIndexes){
  seatIndexes.forEach((i)=>{
    playerId = "player"+i+"-hand"
    playerHand = document.getElementById(playerId)
    playerHand.innerHTML=('<div class="card face-down"></div>'.repeat(10))
  })
}
// replace own card with server distribution
function putCardAtCenter(suite,rank,id){
  id = "table-center-card"+id
  card = document.getElementById(id)
  card.className = `card ${suite} ${rank}`
}

function deleteCardFromHand(suite,rank, id){
  if (id != 0){
    // other player card
    playerHand = document.getElementById("player"+id+"-hand")
    card = playerHand.firstElementChild
    if (card) playerHand.removeChild(card)
  }else{
    // My card
    playerHand = document.getElementById("player0-hand")
    for (const card of [...playerHand.children]){
      if (card.className === `card ${suite} ${rank}`){
        playerHand.removeChild(card)
        break
      }
    }
  }
}
*/


function processServer(data){
  action = data.action
  switch (action){

    case "invalid":
      console.log(data.msg)
      break

    case "cardPlayed":
      updatePage(data)
      cardPlayedSound.play()

      if (clearTableTimeout !== null){
        clearTimeout(clearTableTimeout)
        clearTableTimeout = null
      }
      // Set a timer of 4 seconds before clearing the center
      // To let the players the time to look at what has just been played.
      if (data.center.every(x=>x===null)){
        updateTableCenter(data.lastCenter)
        clearTableTimeout = setTimeout(() => {
          updateTableCenter(data.center)
          clearTableTimeout = null
        }, 4000);
      }else{ updateTableCenter(data.center) }

      break

    /*
    case "bid":
      if (!data.isValid){return}
      playerId = seat2Id(data.seat)
      card = document.getElementById("table-center-card"+playerId)
      card.innerHTML = data.bid
      break
    */

    case "update":
      updatePage(data)
      break

  }
}
function seat2Id(playerSeat){
  return (playerSeat - mySeat + 4)%4
}
function updateRoomId(data){
  // Update roomId
  document.getElementById("roomId").innerHTML = data.roomId
}

function updateTableCenter(center){
  center.forEach((card, seat)=>{
    if (!card){
      className = `card placeholder`
      id = "table-center-card"+seat2Id(seat)
      tablecard = document.getElementById(id)
      tablecard.className = className
    }
    else{
      suite = cardSuite[card[0]]
      rank = cardRank[card[1]-5]
      className = `card ${suite} ${rank}`
      id = "table-center-card"+seat2Id(seat)
      tablecard = document.getElementById(id)
      tablecard.className = className
    }
  })
}

function updatePoints(data){
  const points = data.points
  if ( [2,0].includes(mySeat) ) {
    myPoints = points[0]
    otherPoints = points[1]
  } else {
    myPoints = points[1]
    otherPoints = points[0]
  }
  nous = document.getElementById("points-home")
  vous = document.getElementById("points-away")
  nous.innerHTML = myPoints + " pt"
  vous.innerHTML = otherPoints + " pt"
}

function updateNames(data){
  data.players.forEach((player, seat)=>{
    if (!player){
      playerName = "En attente"
      isActive   = true
    }else{
      playerName = player.name
      isActive   = player.isActive
    }
    id = seat2Id(seat)
    player = document.getElementById("player"+id+"-name")
    player.innerHTML = playerName
    if (!isActive){ player.style.color = "red" } 
    else{ player.style.color="white"}
  })
}
function showTrump(data){
  trumpSuite = cardSuite[data.trump]
  trumpDiv = document.getElementById("trump").className=`card ${trumpSuite}`
}

function renderOtherPlayerHands(data){
  data.cardinality.forEach((number,seat)=>{
    if (["waiting", "biding"].includes(data.state))  number = 10
    id = seat2Id(seat)
    if (seat === mySeat) return
    playerId = "player"+id+"-hand"
    playerHand = document.getElementById(playerId)
    playerHand.innerHTML=('<div class="card face-down"></div>'.repeat(number))
  })
}
function renderMyHand(data){
  if (["waiting"].includes(data.state)){
    playerId = "player0-hand"
    playerHand = document.getElementById(playerId)
    playerHand.innerHTML=('<div class="card face-down"></div>'.repeat(10))
  } else{
    player0Hand = document.getElementById("player0-hand")
    player0Hand.innerHTML = ""
    data.cards.forEach((card) => {
      suite = cardSuite[card[0]]
      rank = cardRank[card[1] - 5]
      card = `<div onclick="playcard(this)" class="card ${suite} ${rank}"></div>`
      player0Hand.innerHTML += card
    });
  }
}

function updatePage(data){
  mySeat = data.mySeat
  updateRoomId(data)
  updateTableCenter(data.center)
  showTrump(data)
  updatePoints(data)
  updateNames(data)
  renderMyHand(data)
  renderOtherPlayerHands(data)
}

function newGame(){
  socket.send("newGame:none")
}
function newHand(){
  shuffleSound.play()
  socket.send("newHand:none")
}

const cardRank = ["five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king", "ace"];
const cardSuite = ["spades","hearts","clubs","diamonds"]


// The function on each player0 cards. 
function playcard(cardEl){
  let card = [null,null]
  cardEl.classList.forEach(className => {

    index = cardSuite.indexOf(className)
    if (index!==-1) card[0] = index

    index = cardRank.indexOf(className)
    if (index!==-1) card[1] = index+5
    msg = "playCard:" + card[0] + "," + card[1]
  });
  console.log("Sending:",msg)
  socket.send(msg)
}