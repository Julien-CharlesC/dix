let mySeat
let clearTableTimeout = null
let next_bid = 50
let turn
let data = null
let trickLocked = false;
let inGame = false
let mouseOnLastTrick = false ;
const cardRank = ["five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king", "ace"];
const cardSuite = ["spades","hearts","clubs","diamonds"]
/*
let cardPlayedSound = new Audio("/audio/cardPlayed.mp3")
*/
let shuffleSound = new Audio("/audio/shuffle.mp3")

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

function toggleMainMenu(){
  if (inGame){
    document.getElementById("home-container").style.display = "block"
    document.getElementById("game-container").style.display = "None"
    document.getElementById("header-buttons").style.display = "none"
    document.getElementById("header").classList.remove("game-header")
  }else{
    document.getElementById("game-container").style.display = "flex"
    document.getElementById("header-buttons").style.display = "flex"
    document.getElementById("home-container").style.display = "none"
    document.getElementById("header").classList.add("game-header")
  }
  inGame = !inGame
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
        toggleMainMenu()
    }
  }})
  .catch((error)=>{
    openDialog('errorDialog',"Erreur de connection au serveur.")
  }
  )
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
  console.log(next_bid)
  console.log(data.bids)
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
    moveCard(randomCard, target)
  }

  if (clearTableTimeout !== null){
    updateTableCenter([null,null,null,null], data)
    clearTimeout(clearTableTimeout)
    clearTableTimeout = null
  }

  // Clean the table early if playedCard before the end of the timer.
  // Set a timer of 4 seconds before clearing the center
  // To let the players the time to look at what has just been played.
  if (data.center.every(x=>x===null) && data.state != "biding" ){
    clearTableTimeout = setTimeout(() => {
      updateTableCenter(data.center, data)
      clearTableTimeout = null
    }, 4000);
  }
}

function processServer(data){
  action = data.action
  showTurn(data)
  switch (action){

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
  document.getElementById("roomId").innerHTML = data.roomId
}

function updateTableCenter(center,data){
  if (trickLocked) return
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
function moveCard(card, target) {

  if (!card || !target) return;

  const cardRect = card.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  // Set up absolute positioning
  card.style.position = "absolute";
  card.style.zIndex = 1000;
  card.style.left = cardRect.left + "px";
  card.style.top = cardRect.top + "px";

  // Move to body to avoid layout conflicts
  document.body.appendChild(card);

  // Force layout reflow
  card.offsetWidth;

  // Start transition
  card.style.transition = "all 0.8s ease";
  card.style.left = targetRect.left + "px";
  card.style.top = targetRect.top + "px";

  // Remove card from DOM after transition
  card.addEventListener("transitionend", () => {
    target.className = card.className
    card.remove();
  }, { once: true });
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

function updatePage(data){
  if (data.action == "bid" || data.state == "biding"){
    updateBid(data)
  } else {
    updateTableCenter(data.center, data)
  }
  updateRoomId(data)
  showTrump(data)
  updatePoints(data)
  updateNames(data)
  renderMyHand(data)
  renderOtherPlayerHands(data)
  showTurn(data)
}

function newGame(){
  socket.send("newGame:none")
}
function newHand(){
  shuffleSound.play()
  socket.send("newHand:none")
}



// The function on each player0 cards. 
function askToPlayCard(cardEl){
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
function showCopy(elem) {
  if (!elem._originalText) {
    elem._originalText = elem.textContent;
    lockWidth(elem);
  }
  elem.textContent = "Copier";
}

function restoreText(elem) {
  if (elem._originalText !== undefined) {
    elem.textContent = elem._originalText;
  }
}
// Ensure that the button does't change in size when inner text become "Copier"
function lockWidth(elem) {
  const width = elem.offsetWidth + "px";
  elem.style.width = width;
}

function showLastTrick() {
  mouseOnLastTrick = true 
  if (!trickLocked && data && ["playing", "end"].includes(data.state)) {
    // Show the trick only if not locked
    updateTableCenter(data.lastCenter, data)
    Array.from(document.getElementById("play-area").children).forEach((child)=>{
      if (child.className == "table-center"){
        return
      }else{
        child.style.filter = "blur(5px)"
      }
    })
  }
}

  
function hideLastTrick() {
  mouseOnLastTrick = false
  if (!trickLocked && data && ["playing", "end"].includes(data.state)) {
    // Hide only if not locked
    Array.from(document.getElementById("play-area").children).forEach((child)=>{
      if (child.className == "table-center"){
        return
      }else{
        child.style.filter = "blur(0px)"
      }
    })
    updateTableCenter(data.center, data)
  }
}

function toggleTrickLock(event) {
  trickLocked = !trickLocked;

  if (trickLocked) {
    showLastTrick();
    // Optional: prevent the click from bubbling to window
    event.stopPropagation();
  } else {
    hideLastTrick();
  }
}

// To detect click elsewhere and unlock
window.addEventListener("click", function () {
  if (trickLocked) {
    trickLocked = false;
    hideLastTrick();
  }
});