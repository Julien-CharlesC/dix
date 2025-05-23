let mySeat
let clearTableTimeout = null
let next_bid = 50
let turn
let socket
let data = null
let audioOn = true
let trickLocked = false;
let cardOrderInversed = false
let inGame = false
let selectedCard = null ;
let lastTrickIsShown = false
const cardRank = ["five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king", "ace"];
const cardSuite = ["spades","hearts","clubs","diamonds"]
let cardPlayedSound = new Audio("/audio/cardPlayed.mp3")
let shuffleSound = new Audio("/audio/shuffle.mp3")

async function createNewRoom(name, isPrivate) {
  const storedName = localStorage.getItem("playerName");
  name =  (name || storedName || "")
  const token = "newRoom:" + name;
  console.log(token)
  const result = await validateConnection(token);

  if (result.ok) {
    connect(token);
  } else if (result.response) {
    const errorObj = await result.response.json();
    openDialog("errorDialog", errorObj.detail);
  }

  closeDialog("createNewRoomDialog");
}

async function joinRoom(name, roomId) {
  const storedName = localStorage.getItem("playerName");
  name =  (name || storedName || "")
  const token = "joinRoom:" + name + "," + roomId;
  console.log(token)
  const result = await validateConnection(token);

  if (result.ok) {
    connect(token);
  } else if (result.response) {
    const errorObj = await result.response.json();
    openDialog("errorDialog", errorObj.detail);
    updateURL(null)
  }

  closeDialog("joinRoomDialog");
}

// Returns: { ok: true, response } or { ok: false, response }
async function validateConnection(token) {
  try {
    const response = await fetch(`/validateConnectionToken?token=${token}`);
    return { ok: response.ok, response };
  } catch (error) {
    openDialog("errorDialog", "Erreur de connexion au serveur.");
    return { ok: false, response: null };
  }
}

function connect(token){

  const wsUrl = `/ws?token=` + token

  socket = new WebSocket(wsUrl)

  socket.onopen = () => { 
    console.log("Connected to:", wsUrl); 
    toggleMainMenu()
  }

  socket.onmessage = (event) => {
      data = JSON.parse(event.data)
      updateScriptState(data)
      console.log("Message from server:", data);
      processServer(data)
  }
  socket.onerror = (event) =>{
      console.log(event)
  }
  socket.onclose = (event) => {
      console.log("Socket closed.")
      toggleMainMenu(getOut=true)
  }
}

window.addEventListener("DOMContentLoaded", () => {
  savedAudioOnStorage = localStorage.getItem("audioOn") 
  if (savedAudioOnStorage !== null) {
    savedAudioOn = savedAudioOnStorage === "true"
    const soundBox = document.getElementById("soundBox");
    if (soundBox) {
      soundBox.checked = savedAudioOn ;
    }
  }

  cardOrderInversedStorage = localStorage.getItem("cardOrderInversed") === "true" ;
  if (cardOrderInversedStorage !== null) {
    cardOrderInversed = cardOrderInversedStorage === "true"
    const cardBox = document.getElementById("cardOrder");
    if (cardBox) {
      cardBox.checked = cardOrderInversed 
    }
  }
});

window.addEventListener("load", () => {

  // Auto Join if the url containt roomId Token
  const roomId = new URLSearchParams(window.location.search).get("roomId");
  if (roomId){ 
    const storedName = localStorage.getItem("playerName");
    if (storedName) {
      joinRoom(storedName, roomId)
    } else {
      openDialog("preRoom")
      dialog = document.getElementById("preRoom")
      dialog.addEventListener("submit", () => {
        const form = dialog.querySelector("form");
        const nameInput = form.elements["username"];
        const name = nameInput.value.trim();
        joinRoom(name, roomId);
      }, { once: true });
    }
  }
});

window.addEventListener("beforeunload", (event) => {
  if (socket) socket.close()
});



function getRoomsList() {
  fetch('/roomsList')
    .then(async (response) => {
      if (!response.ok){ console.log("Error fetching roomsList") ; return;}
      const roomsList = await response.json(); // Correct way to parse JSON
      const selection = document.getElementById("table-list");
      let html = "";

      roomsList.forEach((room) => {
        html += `<option class="room-option" value="${room.roomId}">Table de ${room.name} (${room.numBots + room.numHumans}/4)</option>`;
      });

      selection.innerHTML = html;
    })
    .catch((error) => {
      openDialog('errorDialog', "Erreur de connection au serveur.");
    });
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
function quit(){
  toggleMainMenu(getOut=true)
  if ( socket ) socket.close()
}

function toggleMainMenu(getOut=null){
  if (getOut || inGame){
    inGame = false
    updateURL(null)
    document.getElementById("home-container").style.display = "block"
    document.getElementById("game-container").style.display = "None"
    document.getElementById("header-buttons").style.display = "none"
    document.getElementById("header").classList.remove("game-header")
  }else{
    inGame = true
    document.getElementById("game-container").style.display = "flex"
    document.getElementById("header-buttons").style.display = "flex"
    document.getElementById("home-container").style.display = "none"
    document.getElementById("header").classList.add("game-header")
  }
}


function updateScriptState(data){
  mySeat = data.mySeat
  turn = data.turn
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
function updateBid(data){
  if (data.state != "biding"){
    document.querySelectorAll('.bid-button, .pass-button').forEach(elem=>{
      elem.style.display = "none"
    })
  } else {
    document.querySelectorAll('.bid-button, .pass-button').forEach(elem=>{
      elem.style.display = "inline-flex"
    })
  }
  next_bid = Math.max(...data.bids, 45)+5
  myCard = document.getElementById("table-center-card0")
  data.bids.forEach((bid,seat)=>{

    id = "table-center-card"+seat2Id(seat)
    tablecard = document.getElementById(id)
    className = `card placeholder`

    bid = data.bids[seat]
    if (bid==0) bid = "&empty;"
    tablecard.className = className
    tablecard.innerHTML = bid

    if (data.turn == mySeat){
      if (data.state == "biding") myCard.innerHTML = next_bid
      myCard.classList.add("glow")
    } else {
      myCard.classList.remove("glow")
    }
  })
  nousBid = Math.max(data.bids[mySeat], data.bids[(mySeat+2)%4])
  vousBid = Math.max(data.bids[mySeat+1], data.bids[(mySeat+3)%4])
  if (nousBid == 0) nousBid = "&empty;"
  if (vousBid == 0) vousBid = "&empty;"

  nous = document.getElementById("bid-home").innerHTML = "Mise : " + nousBid
  vous = document.getElementById("bid-away").innerHTML = "Mise : " + vousBid
}

function findMyCard(strSuite,strRank){
  myHand = document.getElementById("player0-hand")
  myCard = Array.from(myHand.children).find((child)=>{
    return (child.classList.contains(strSuite) && 
            child.classList.contains(strRank))
  })
  return myCard
}

function playCard(data){
  playerSeat = parseInt(data.msg.split(",")[0])
  suite = parseInt(data.msg.split(",")[1])
  rank = parseInt(data.msg.split(",")[2])
  suite = cardSuite[suite]
  rank = cardRank[rank-5]
  if (playerSeat == mySeat){
    myCard = findMyCard(suite,rank)
    target = document.getElementById("table-center-card0")
    moveCard(myCard,target)
  }else{
    id = seat2Id(playerSeat)
    playerCards = document.getElementById("player"+id+"-hand").children;
    randomCard = playerCards[Math.floor(Math.random() * playerCards.length)];
    randomCard.className = `card ${suite} ${rank}`
    target = document.getElementById("table-center-card"+id)
    if (window.innerWidth < 750){ 
      sourceEl = document.getElementById("player"+id+"-name")
      moveCard(randomCard,target,sourceEl)
    }
    else{moveCard(randomCard,target)}
  }

  if (clearTableTimeout !== null){
    if (lastTrickIsShown){ updateTableCenter(data.lastCenter, data)}
    else {updateTableCenter([null,null,null,null], data)}
    clearTimeout(clearTableTimeout)
    clearTableTimeout = null
  }

  // Clean the table early if playedCard before the end of the timer.
  // Set a timer of 4 seconds before clearing the center
  // To let the players the time to look at what has just been played.
  if (data.center.every(x=>x===null) && data.state != "biding" ){
    clearTableTimeout = setTimeout(() => {
      if (lastTrickIsShown) {
        updateTableCenter(data.lastCenter, data)
      }else{
        updateTableCenter(data.center, data)
      }

      clearTableTimeout = null
    }, 4000);
  }
}

function updateURL(data){
  const url = new URL(window.location.href)
  if (data && inGame){
    url.searchParams.set("roomId", data.roomId)
  }else{
    url.searchParams.delete("roomId")
  }
  window.history.replaceState({},"",url);
}

function processServer(data){
  action = data.action
  showTurn(data)
  switch (action){

    case "playerJoined":
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
      updatePoints(data)
      playCard(data)

      break

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
  document.getElementById("roomIdCopy").innerHTML = data.roomId
}

function updateTableCenter(center,data){
  center.forEach((card, seat)=>{
    if (data.state == "biding"){
      bid = data.bids[seat]
      if (bid==0) bid = "&empty;"
      id = "table-center-card"+seat2Id(seat)
      tablecard = document.getElementById(id)
      tablecard.innerHTML = bid
      className = `card placeholder`
      tablecard.className = className
      return
    }
    if (!card){
      className = `card placeholder`
      id = "table-center-card"+seat2Id(seat)
      tablecard = document.getElementById(id)
      tablecard.innerHTML = ""
      tablecard.className = className
    }
    else{
      suite = cardSuite[card[0]]
      rank = cardRank[card[1]-5]
      className = `card ${suite} ${rank}`
      id = "table-center-card"+seat2Id(seat)
      tablecard = document.getElementById(id)
      tablecard.innerHTML = ""
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
    if (player && player.seat == mySeat) localStorage.setItem("playerName", player.name);
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
    const playerPlace = document.getElementById("playerPlace" + id)
    playerPlace.innerHTML = playerName
  })
  host = document.getElementById("player"+seat2Id(data.host)+"-name")
  host.innerHTML += " : host" // display a crown for the host
  //host.innerHTML += "&#128081;" // display a crown for the host

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
function moveCard(card, target, sourceEl=null) {

  if (!card || !target) return;

  const cardRect = (sourceEl || card).getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  if (lastTrickIsShown){
    card.classList.add("blurred")
  } 

  // Set up absolute positioning
  card.style.position = "absolute";
  card.style.zIndex = 10;
  card.style.left = cardRect.left + "px";
  card.style.top = cardRect.top  + "px";

  // Move to body to avoid layout conflicts
  document.body.appendChild(card);
  card.classList.add("movingCard")

  // Force layout reflow
  card.offsetWidth;

  // Start transition
  card.style.transition = "left 0.8s ease, top 0.8s ease, filter 0s";
  card.style.left = targetRect.left + "px";
  card.style.top = targetRect.top + "px";

  // Remove card from DOM after transition
  card.addEventListener("transitionend", () => {
    cardInt = card2Int(card)
    suite = cardInt[0]
    rank  = cardInt[1]
    if (!lastTrickIsShown &&
    // At the end of the transition, if the card is not from the actual trick,
    // we do not show it at the center.
      !(
      data.lastCenter.filter(x=>x!==null).some(x=>x[0]==suite && x[1]==rank)
      && 
      data.center.some(x=>x!==null)
      )
    ){ target.className = `card ${cardSuite[suite]} ${cardRank[rank-5]}`}
    card.remove();
  }, { once: true });
}
function changeCardOrder(bool){
  console.log("box",bool)
  localStorage.setItem("cardOrderInversed", bool);
  cardOrderInversed=bool
  renderMyHand(data)
}

function renderMyHand(data){
  if (["waiting"].includes(data.state)){
    playerId = "player0-hand"
    playerHand = document.getElementById(playerId)
    playerHand.innerHTML=('<div class="card face-down"></div>'.repeat(10))
  } else{
    player0Hand = document.getElementById("player0-hand")
    player0Hand.innerHTML = ""

    cards = cardOrderInversed ? data.cards.slice().reverse() : data.cards
    console.log(cards)
    cards.forEach((card) => {
      suite = cardSuite[card[0]]
      rank = cardRank[card[1] - 5]
      card = `<div onclick="askToPlayCard(this)" class="card ${suite} ${rank}"></div>`
      player0Hand.innerHTML += card
    });
  }
}
function showTurn(data){
  for(let id = 0; id<4 ; id++){
    nameDiv = document.getElementById("player"+id+"-name")
    if (id == seat2Id(data.turn)){
      nameDiv.classList.add("glow")
    }else{
      nameDiv.classList.remove("glow")
    }
  }
}
function deleteMovingCards(){
  Array.from(document.getElementsByClassName("movingCard")).forEach((card)=>{
    card.remove()
  })
}

function updatePage(data){
  if (data.state == "biding"){
    updateBid(data)
  } else if(!lastTrickIsShown) {
    updateTableCenter(data.center, data)
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
}

function newGame(){
  if (data && mySeat == data.host) socket.send("newGame:none")
}

function botTime2Act(sec){
  if (socket && data && data.host == mySeat) socket.send("botTime2Act:"+sec)
}
function id2Seat(id){
  return (mySeat + id)%4
}

function changeSeat(id){
  if (!data || data.state != "waiting") return
  seat = id2Seat(id)
  if ( seat != mySeat && socket && data && inGame ){
    socket.send("changeSeat:"+seat)
  } 
}

function newHand(){
  if (audioOn && data && data.host == mySeat) shuffleSound.play()
  if (data && mySeat == data.host) socket.send("newHand:none")
}

window.addEventListener("resize", () => {
  if (window.innerWidth >= 750) {
    // When the screen is over 750 width, no "confirm" selectedCard shenanigan
    removeAllSelectedCard()
    selectedCard = null
  }
  player2 = document.getElementById("player2")
  lockHeight(player2)
});

function removeAllSelectedCard(skip=null){
  Array.from(document.getElementsByClassName("selectedCard")).forEach((child)=>{
    if (child === skip) return
    child.classList.remove("selectedCard")
  })
}
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

function isCardValid(cardEl){
  if (data === null) return false
  // Not the player's turn
  if (data.turn != mySeat ) return false
  // Not the time to play
  if (data.state != "playing") return false

  card = card2Int(cardEl)
  suite = card[0]
  rank = card[1]

  // First card of the trick is always valid
  if (data.center.every(x=>x===null)){
    return true
  }
  count = data.center.reduce((acc,val)=>{
    if (val !== null) return acc+1
    return acc }
  ,0)
  askedSuite = data.center[(data.turn-count+4)%4][0]
  // If it's the correct suite, it's valid
  if (suite===askedSuite) return true
  // If the player try to play a card that is not the askedSuite
  // when he has the suite, return false.
  for (let card of data.cards){
    if (card[0] === askedSuite) return false
  }
  return true
}

// The function on each player0 cards. 
function askToPlayCard(cardEl){
  if (!isCardValid(cardEl)){
    cardEl.classList.add("shake-error");
  
    setTimeout(() => {
      cardEl.classList.remove("shake-error");
    }, 1000);
    return
  } 

  if (window.innerWidth < 750 && ( selectedCard != cardEl) ) { 
    removeAllSelectedCard(skip=cardEl)
    selectedCard = cardEl
    cardEl.classList.add("selectedCard")
    return
  }
  if (window.innerWidth < 750 && ( selectedCard === cardEl) ) { 
    cardEl.classList.remove("selectedCard")
  }
  card = card2Int(cardEl)
  suite = card[0]
  rank = card[1]
  msg = "playCard:" + suite + "," + rank 
  console.log("Sending:",msg)
  socket.send(msg)
}

function lowerBid(){
  if (turn != mySeat) return
  card = document.getElementById("table-center-card0")
  if (!parseInt(card.innerHTML)){
    card.innerHTML = next_bid
  } else {  
    newValue = Math.max(next_bid, parseInt(card.innerHTML) - 5)
    card.innerHTML = newValue
  }
}
function augmentBid(){
  if (turn != mySeat) return
  card = document.getElementById("table-center-card0")
  if (!parseInt(card.innerHTML)){
    card.innerHTML = next_bid
  } else {  
    newValue = Math.min(100,parseInt(card.innerHTML) + 5)
    card.innerHTML = newValue
  }
}

function passBid(){
  if (turn != mySeat) return
  socket.send("bid:0")
}

function confirmBid(){
  if (turn != mySeat) return
  card = document.getElementById("table-center-card0")
  bid = parseInt(card.innerHTML)
  if (!bid) bid = next_bid
  socket.send("bid:"+bid)
}

// deprecated, use to copy roomId to clipboard
function copyToClipboard(elem) {
  text = elem._originalText
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(err => console.error("Clipboard write failed:", err));
  } else {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      console.error("Fallback copy failed", err);
    }
    document.body.removeChild(textarea);
  }
}
// deprecated, use to copy roomId to clipboard
function showCopy(elem) {
  if (!elem._originalText) {
    elem._originalText = elem.textContent;
    lockWidth(elem);
  }
  elem.textContent = "Copier";
}

// deprecated, use to copy roomId to clipboard
function restoreText(elem) {
  if (elem._originalText !== undefined) {
    elem.textContent = elem._originalText;
  }
}
// Ensure that the button does't change in size when inner text become "Copier"
function lockWidth(elem) {
  elem.style.width= ''; 
  const width = elem.offsetWidth + "px";
  elem.style.width = width;
}
function lockHeight(elem) {
  elem.style.height = ''; 
  const height = elem.offsetHeight + "px";
  elem.style.height = height;
}


function askShowLastTrick(){
  if (trickLocked) return
  if (data && ["playing", "end"].includes(data.state)) {
    showLastTrick()
  }
}

function askHideLastTrick(){
  if (trickLocked) return
  if (data && ["playing", "end"].includes(data.state)) {
    hideLastTrick()
  }

}
function showLastTrick() {
  lastTrickIsShown = true
  updateTableCenter(data.lastCenter, data)
  for(let i = 0;i < 4; i++){
    centerCard =document.getElementById("table-center-card"+i)
    centerCard.style.zIndex = 100
  }
  Array.from(document.getElementById("play-area").children).forEach((child)=>{
    if (child.className == "table-center"){
      return
    }else{
      child.style.filter = "blur(5px)"
    }
  })
}

  
function hideLastTrick() {
  lastTrickIsShown = false
  for(let i = 0;i < 4; i++){
    centerCard =document.getElementById("table-center-card"+i)
    centerCard.style.zIndex = "auto"
  }
  Array.from(document.querySelectorAll(".movingCard")).forEach((el)=>{
    el.style.filter = "blur(0px)"
    el.classList.remove = "blurred"
  })

  Array.from(document.getElementById("play-area").children).forEach((child)=>{
    if (child.className == "table-center"){
      return
    }else{
      child.style.filter = "blur(0px)"
    }
  })
  updateTableCenter(data.center, data)
}


function toggleTrickLock(event) {
  if ( !data || !["playing", "end"].includes(data.state)) { return }

  if (!trickLocked) {
    showLastTrick();
    event.stopPropagation();
    const toggleTrickHandler = function (e) {
      // prevent recursion if the click is on the same element
      e.stopPropagation()
      window.removeEventListener("click", toggleTrickHandler);
      if (e.target === event.target) return;
      hideLastTrick();
      trickLocked = false;
      lastTrickIsShown = false;
    };
    window.addEventListener("click", toggleTrickHandler);
  } else {
    hideLastTrick();
  }
  trickLocked = !trickLocked
}

function setAudio(bool){
  audioOn = bool
  localStorage.setItem("audioOn", bool);
}