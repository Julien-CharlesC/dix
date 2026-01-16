/*- 
-----------------------------------------------
        Script states and parameters
-----------------------------------------------

*/
let audioOn = true
let cardOrderInversed = false

let mySeat
let clearTableTimeout = null
let turn
let socket
let data = null
let trickLocked = false;
let inGame = false
let selectedCard = null ;
let lastTrickIsShown = false
const cardRank = ["five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king", "ace"];
const cardSuite = ["spades","hearts","clubs","diamonds"]
let cardPlayedSound = new Audio("/audio/cardPlayed.mp3")
let shuffleSound = new Audio("/audio/shuffle.mp3")
/*- 
-----------------------------------------------

-----------------------------------------------
*/


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

function openDialog(dialogId, title=""){
  const dialog = document.getElementById(dialogId)
  dialog.showModal()
  if (title){
    dialog.querySelector("h2").innerHTML =title 
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

function changeName(newName){

    newName = newName.trim()
    var alphanum = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 "

    for (i=0; i<newName.length; i++){
        var car = newName[i] ;
        if (alphanum.indexOf(car) == -1) {
            openDialog("errorDialog", "Le nom doit contenir uniquement des caractères alphanumériques") ;
            return ;
        }
    }

    if (newName.length <= 2 || newName >= 21){
        openDialog("errorDialog", "Le nom doit être entre 3 et 20 caractères.");
    }else{
        socket.send("nameChange:"+newName)
    }
}


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
  updateBidWinner(data)
}

function updateBidWinner(data){
  nousBid = Math.max(data.bids[mySeat], data.bids[(mySeat+2)%4])
  vousBid = Math.max(data.bids[(mySeat+1)%4], data.bids[(mySeat+3)%4])
  if (nousBid == 0) nousBid = "&empty;"
  if (vousBid == 0) vousBid = "&empty;"
  nous = document.getElementById("bid-home").innerHTML = "Mise : " + nousBid
  vous = document.getElementById("bid-away").innerHTML = "Mise : " + vousBid
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

    // If the random selected card is allready played, take the idx-1
    // This happen if random selected the same card under the 2sec transition
    idx = Math.floor(Math.random() * playerCards.length)
    randomCard = playerCards[idx];

    var numTry = 0
    while (randomCard.style.visibility == "hidden" && numTry < 10){
      idx = (idx+1)%playerCards.length
      randomCard = playerCards[idx];
      numTry += 1
    }
    randomCard.className = `card ${suite} ${rank} ${id}`

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


function updateRoomId(data){
  // Update roomId
  document.getElementById("roomIdCopy").innerHTML = data.roomId
}

function updateTableCenter(center,data){
  if (data.state != "biding"){
    document.querySelectorAll('.bid-button, .pass-button').forEach(elem=>{
      elem.style.display = "none"
    })
  } 
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

function updateHistory(data){
  // First we update the history
  const table = document.getElementById("history-container")
  const title = table.firstElementChild.firstElementChild
  if ( [2,0].includes(mySeat) ) {
    myIndex = 0 
    otherIndex = 1 
  } else {
    myIndex = 1
    otherIndex = 0
  }

  var pointsArr = JSON.parse(JSON.stringify(data.pointsHistory));
  pointsArr.unshift([0,0])

  var rows = ""
  for (let i = pointsArr.length - 1 ; i > 0 ; i--){
    points = pointsArr[i]
    homePoint = points[myIndex]
    otherPoint = points[otherIndex]
    homeDiff = homePoint - pointsArr[i-1][myIndex]
    otherDiff = otherPoint - pointsArr[i-1][otherIndex]
    rows += `
    <tr>
      <td style="color:${homeDiff>=0 ? 'green':'red'}">${homeDiff>=0 ? '+': ''}${homeDiff}</td>
      <td>${homePoint}</td>
      <td>${otherPoint}</td>
      <td style="color:${otherDiff>=0 ? 'green':'red'}">${otherDiff>=0 ? '+': ''}${otherDiff}</td>
    </tr>
    `
  }
  rows += `
  <tr>
    <td></td>
    <td>0</td>
    <td>0</td>
    <td></td>
  </tr>
  `
  table.innerHTML = title.innerHTML + rows

  // This adds the just acquired points as an animation.
  if (data.state == "end" && data.pointsHistory.length>=1){
    const homeRect = getRect("bid-home")
    const otherRect = getRect("bid-away")

    const diffDiv= (diff, rect) =>{
      const el = document.createElement("div")
      el.style.color = `${diff>=0 ? 'green':'red'}`
      el.style.position = "absolute"
      el.innerHTML = `${diff>=0 ? '+': ''}${diff}`
      el.className = "points-popup"
      el.style.zIndex = 2
      el.style.left = rect.left + "px";
      el.style.top = rect.bottom  + "px";
      el.style.width = rect.width + "px";
      el.style.height = rect.height + "px";
      el.style.fontSize = "2rem"
      el.style.fontWeight = "bold"
      el.style.textAlign = "center"
      return el
    }
    pointsNow = pointsArr[pointsArr.length-1]
    pointsPrevious = pointsArr[pointsArr.length-2]

    pointsDiff = pointsNow.map(function(item,index){
      return item - pointsPrevious[index]
    })
    const homeDiff = diffDiv(pointsDiff[myIndex], homeRect)
    const otherDiff = diffDiv(pointsDiff[otherIndex], otherRect)
    document.body.appendChild(homeDiff);
    document.body.appendChild(otherDiff);
    setTimeout(()=>{
      homeDiff.classList.add("fading-out")
      otherDiff.classList.add("fading-out")
      setTimeout(()=>{
        homeDiff.remove()
        otherDiff.remove()
      },3000)
    },7000)
  }
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
    const playerPlace = document.getElementById("playerPlace" + id)
    if (playerName == "En attente"){
      playerPlace.innerHTML = "Libre"
    }else{
      playerPlace.innerHTML = playerName
    }
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


  const movingCard = card.cloneNode(true)
  document.body.appendChild(movingCard);
  movingCard.classList.add("movingCard")
  const inHandCard  = card

  // This is for reducing the hand size smoothly
  inHandCard.style.visibility = "hidden"
  inHandCard.style.transition = "padding 1s, border 1s, margin 1s" 
  // vertical
  if (inHandCard.classList.contains("1") || inHandCard.classList.contains("3") ){
    inHandCard.style.marginBottom = "-4.885rem" // the gap between cards
    inHandCard.style.marginTop = "-0.885rem" // the gap between cards
    inHandCard.style.paddingLeft = "0px"
    inHandCard.style.paddingRight = "0px"
  // Horizontal 
  }else if(inHandCard.classList.contains("2")){
    inHandCard.style.marginLeft = "-2.885rem" // the gap between cards
    inHandCard.style.marginRight = "-0.885rem" // the gap between cards
    inHandCard.style.paddingTop = "0px"
    inHandCard.style.paddingBottom= "0px"
  // My Hand
  }else{
    inHandCard.style.padding = "0px"
    inHandCard.style.border = "0px"
    inHandCard.style.margin = "0 -0.35rem" // the gap between cards
  }
  setTimeout(()=>{
    inHandCard.remove()
  },2000)


  // Set up absolute positioning, the moving-card
  movingCard.style.position = "absolute";
  movingCard.style.zIndex = 10;
  movingCard.style.left = cardRect.left + "px";
  movingCard.style.top = cardRect.top  + "px";


  // Force layout reflow
  movingCard.offsetWidth;

  // Start transition
  movingCard.style.transition = "left 0.8s ease, top 0.8s ease, filter 0s";
  movingCard.style.left = targetRect.left + "px";
  movingCard.style.top = targetRect.top + "px";

  // Remove movingCard from DOM after transition
  movingCard.addEventListener("transitionend", () => {
    movingCardInt = card2Int(movingCard)
    suite = movingCardInt[0]
    rank  = movingCardInt[1]
    if (!lastTrickIsShown &&
    // At the end of the transition, if the movingCard is not from the actual trick,
    // we do not show it at the center.
      !(
      data.lastCenter.filter(x=>x!==null).some(x=>x[0]==suite && x[1]==rank)
      && 
      data.center.some(x=>x!==null)
      )
    ){ target.className = `card ${cardSuite[suite]} ${cardRank[rank-5]}`}
    movingCard.remove();
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


function newGame(){
  if (data && mySeat == data.host){
    socket.send("newGame:none")
  } 
}

function botTime2Act(sec){
  if (socket && data && data.host == mySeat) socket.send("botTime2Act:"+sec)
}

function changeSeat(id){
  if (!data || data.state != "waiting") return
  seat = id2Seat(id)
  if ( seat != mySeat && socket && data && inGame ){
    socket.send("changeSeat:"+seat)
  } 
}

function newHand(){
  if (data && mySeat == data.host) socket.send("newHand:none")
}


// For mobile, remove the highlight from card pre-selection/confirmation
function removeAllSelectedCard(skip=null){
  Array.from(document.getElementsByClassName("selectedCard")).forEach((child)=>{
    if (child === skip) return
    child.classList.remove("selectedCard")
  })
}

// Return a bool if a card is valid to play
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

// This function is on each player0 (self) cards. 
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

function toggleOpen(elId){
  const el = document.getElementById(elId)
  el.classList.toggle("open")
}
function openSettings(){
  DialogId = "settingsDialog"
  settingsDialog = document.getElementById(DialogId)

  if (inGame && data && data.state == "waiting"){
    settingsDialog.querySelectorAll('.pregameSettings').forEach(child=>{
      child.style.display = "block"
    })
  }else{
    settingsDialog.querySelectorAll('.pregameSettings').forEach(child=>{
      child.style.display = "none"
    })
  }

  openDialog(DialogId)
}