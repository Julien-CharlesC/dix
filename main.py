from fastapi import FastAPI, HTTPException, WebSocket, Query,WebSocketException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from GamesManager import GamesManager
from string import ascii_letters, digits
alphanum = ascii_letters+digits
import re

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/graphics", StaticFiles(directory="graphics"), name="graphics")
app.mount("/audio", StaticFiles(directory="audio"), name="audio")

with open("static/index.html", "r") as f:
    homePage = f.read()

gm = GamesManager()

@app.get("/", response_class=HTMLResponse)
async def home():
    return HTMLResponse(content=homePage)

@app.get("/validateConnectionToken")
async def validateConnectionToken(
    token:str= Query(
        ..., description="The action:value token.", max_length=30
    )
):
    # Validate and return the separated token. Raises HTTP error otherwise.
    action,value = _validateConnectionToken(token)
    return

def _validateConnectionToken(token):

    # Check if there is too many connection socket
    if (
        gm.total_connection >= gm.number_allowed_alive_games*4
        or 
        len(gm.games) > gm.number_allowed_alive_games
    ) :
        raise HTTPException(status_code=503, detail="Too many players for server capacity.")

    # Sanitize and process token
    if (
        any([(car not in alphanum+":,") for car in token])
        or
        not ( m:= re.match(r'^(\w+):((?:\w+,?)+)$',token)) 
    ):
        raise HTTPException( status_code=400, detail="Bad connection token.")
    action, value = m[1], m[2]

    match action :
        case "newRoom":
            if sum([car=="," for car in value]) >= 1: 
                raise HTTPException( status_code=400, detail="Bad connection token.")
            playerName = value
            if playerName == "null" or playerName == "" or len(playerName) <= 2 or len(playerName) >=21 :
                raise HTTPException( status_code=400, detail="Le nom doit être entre 3 et 20 caractères.")
            return action,playerName
        case "joinRoom":
            nbrComma = sum([car=="," for car in value]) 
            if 0 == nbrComma or nbrComma >= 2: 
                raise HTTPException( status_code=400, detail="Bad connection token.")
            playerName,roomId = value.split(",")
            canPlayerJoin, fooBar = gm.wherePlayerCanJoin(roomId, playerName)
            if not canPlayerJoin :
                errorMsg = fooBar
                raise HTTPException( status_code=401, detail=errorMsg)
            seatIndex = fooBar
            return action,(playerName, roomId, seatIndex)
        case _:
            raise HTTPException( status_code=400, detail="Bad connection token.")

@app.websocket("/ws")
async def websocket(
    ws : WebSocket,
    token:str= Query(
        ..., description="The action:value token.", max_length=30
    )
):
    # Validate and return the separated token. Raises HTTP error otherwise.
    action,value = _validateConnectionToken(token)
    
    match action :
        case "newRoom":
            roomId = gm.generateRoomId()
            playerName = value
            gm.createRoom(roomId, playerName)
            await gm.connect(ws,roomId,playerName, 0)
        case "joinRoom":
            playerName,roomId,seatIndex = value
            await gm.connect(ws,roomId,playerName, seatIndex)
        case _:
            print("Tea")
            raise HTTPException( status_code=418)

if __name__== "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=True)
