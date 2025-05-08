from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from string import ascii_letters, digits
alphanum = ascii_letters+digits
from random import choice
from Table import Table
import re, json, asyncio
from Models.Room import Room, Player

class GamesManager():

    def __init__(self):
        self.games = dict()
        self.number_allowed_alive_games = 5
        self.lengthOfRoomId = 5
        self.total_connection = 0

    def generateRoomId(self):    
        
        roomId = "".join([ choice(alphanum) for _ in range(self.lengthOfRoomId) ])
        while self.doesRoomIdExist(roomId):
            roomId = "".join([ choice(alphanum) for _ in range(self.lengthOfRoomId) ])
        return roomId

    def doesRoomIdExist(self,roomId):
        for gameRoomId in self.games.keys():
            if roomId == gameRoomId :
                return True 
        return False 
    

    def createRoom(self,roomId,playerName):
        room = Room(
            roomId = roomId,
            roomName = playerName,
        ) 
        self.games[roomId] = room
        return room

    def processGameToken(self,token):
        if ( 
            len(token) >= 20 or 
            any([(car not in alphanum+":,") for car in token]) or
            not ( m:= re.match(r'(\w+):((?:\w+,?)+)',token))
        ) : raise HTTPException( status_code=400, detail="Bad game token.")

        return m[1], m[2]

    def wherePlayerCanJoin(self,roomId,playerName):
        # chech if room exist
        if not self.doesRoomIdExist(roomId):
            return False, "The room doesn't exist."
        room = self.games[roomId]

        for seat,player in enumerate(room.players):
            # check if the name is not allready taken AND connected 
            if player is not None and player.name == playerName and player.isActive :
                return False, "Name allready taken."
            # check if player want to reconnect
            if player is not None and player.name == playerName and not player.isActive :
                return True, seat

        # check is there is an available seat
        if not any(player is None for player in room.players):
            return False, "The room if full."

        return True, room.players.index(None)

    # Suppose that all verification is done and that the connection
    # is secure and will succed to the room
    async def connect(self,ws:WebSocket,roomId,playerName,indexSeat):
        
        await ws.accept()
        self.total_connection += 1
        room = self.games.get(roomId)
        print(f"{self.total_connection=}")
        player = Player(
            isActive = True,
            isBot = False,
            ws = ws,
            name = playerName,
            seat = indexSeat
        )
        room.players[indexSeat] = player
        # TODO action is newPlayer arrived
        await self.playerAct("update","",room,player)

        try :
            while True:
                action,value = self.processGameToken(await ws.receive_text())
                await self.playerAct(action,value,room,player)
        except WebSocketDisconnect:
            self.total_connection -= 1
            room.players[indexSeat].isActive = False
            print(f"{self.total_connection=}")
            # Del the room if no player in it.
            if not any(player.isActive for player in room.humans):
                self.games.pop(roomId)
            else :
                await self.playerAct("update","",room,player)
        except : 
            self.total_connection -= 1
            raise Exception

    async def updatePlayers(self, room, action, msg=""):
        state = room.state | { "action" : action, msg:msg} 
        for player in room.humans:
            state.update({
                "cards" : room.table.ts.hands[player.seat],
                "mySeat": player.seat, 
            })
            await player.ws.send_text({json.dumps(state)})

    async def updatePlayer(self, room, action, player, msg=""):
        state = room.state | {"action" : action, msg:msg} 
        state.update({
            "cards" : room.table.ts.hands[player.seat],
            "mySeat": player.seat, 
        })
        await player.ws.send_text(json.dumps(state))

    async def playerAct(self,action,value,room,player):
        print(action,value)
        state : dict = room.state
        table = room.table
        match action:
            case "bid":
                pass
                """
                bid = "&empty;" if value == "0" else value
                msg = {
                    "isValid":True,
                    "action" : "bid",
                    "seat": indexSeat, 
                    "bid": value,
                }
                await self.sendMsg2Room(msg,room)
                """
                
            case "update":
                await self.updatePlayers(room, "update")

            case "newHand":
                table.newHand()
                room.fillEmptySeatsWithRandoBot()
                await self.updatePlayers(room, "update")

            case "newGame":
                # Only keep active players, dismissing not connected players.
                room.kickNoneHumans()
                table.newGame()
                await self.updatePlayers(room, "update")

            case "playCard":
                if ( not re.match(r'^[0-3],(?:5|6|7|8|9|1[0-4])$',value)):
                    player.ws.send_text(json.dumps({"isValid":False , "validationMsg" : "Bad game token"}))
                    player.ws.close ; return
                suite,rank = map(int,value.split(","))
                isValid, validationMsg = table.isValidPlayCard(player.seat,[suite,rank])
                if isValid : 
                    table.playCard(player.seat,[suite,rank])
                    await self.updatePlayers(room, "cardPlayed")

                    #Bot playing
                    while room.players[table.ts.turn].isBot and table.ts.state == "playing" :
                        player = table.ts.turn
                        suite,rank = table.randomCard(player)
                        print(f"Bot{table.ts.turn} will play:", suite, rank)
                        if not table.isValidPlayCard(player, [suite,rank]): break
                        table.playCard(player, [suite,rank])
                        await asyncio.sleep(1)
                        await self.updatePlayers(room, "cardPlayed")

                else :  #Is not a valid playCard action
                    await self.updatePlayer(room, "invalid", player, msg=validationMsg)
            case _:
                player.ws.send_text(json.dumps({isValid:False , "validationMsg" : "Bad game token"}))
                player.ws.close ; return

                