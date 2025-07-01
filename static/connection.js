async function createNewRoom(name, isPrivate, gameType) {
  const storedName = localStorage.getItem("playerName");
  name =  (name || storedName || "")
  const token = "newRoom:" + name + "," + isPrivate + "," + gameType;
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

// Connects the player with websocket to server.
function connect(token){

  const wsUrl = `/ws?token=` + token

  socket = new WebSocket(wsUrl)

  socket.onopen = () => { 
    console.log("Connected to:", wsUrl); 
    toggleMainMenu() // switch to the table
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
      toggleMainMenu(getOut=true) // switch to the menu
  }
}

// Load the settings from the cache.
window.addEventListener("DOMContentLoaded", () => {
  savedAudioOnStorage = localStorage.getItem("audioOn") 
  if (savedAudioOnStorage !== null) {
    audioOn = savedAudioOnStorage === "true"
    const soundBox = document.getElementById("soundBox");
    if (soundBox) {
      soundBox.checked = audioOn ;
    }
  }

  cardOrderInversedStorage = localStorage.getItem("cardOrderInversed") ;
  if (cardOrderInversedStorage !== null) {
    cardOrderInversed = cardOrderInversedStorage === "true"
    const cardBox = document.getElementById("cardOrder");
    if (cardBox) {
      cardBox.checked = cardOrderInversed 
    }
  }
});


// Auto Join if the url containt roomId Token
window.addEventListener("load", () => {

  const roomId = new URLSearchParams(window.location.search).get("roomId");
  if (roomId){ 
    // If playerName in cache, directly connects the player
    const storedName = localStorage.getItem("playerName");
    if (storedName) {
      joinRoom(storedName, roomId)
    } else {
      // otherwise ask the player it's name
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

// When user quit, close the socket. Makes thing smoother for refresh.
window.addEventListener("beforeunload", (event) => {
  if (socket) socket.close()
});

//  Add/remove the roomId in the URL
function updateURL(data){
  const url = new URL(window.location.href)
  if (data && inGame){
    url.searchParams.set("roomId", data.roomId)
  }else{
    url.searchParams.delete("roomId")
  }
  window.history.replaceState({},"",url);
}