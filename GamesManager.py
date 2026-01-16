from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query
from string import ascii_letters, digits
idAlphabet = ascii_letters+digits
alphanum = ascii_letters+digits + "- " + "ùûüÿàâçéèêëïîôÙÛÜŸÀÂÇÉÈÊËÏÎÔ"
from random import choice, random
import re, json, asyncio
import traceback

from Models.Room import Room, Player
from Models.Table import Table
from Models.RandoBot import RandoBot

# Sample syllables and themes
prefixes = ["Bit", "Byte", "Null", "Bug", "Stack", "Heap", "Seg", "Core", "RAM", "Cache", "Fork", "Ping", "Loop", "Zero", "Crypto", "Kernel", "Git", "Mega", "Nano", "Logic"]
middles = ["ly", "on", "rix", "ta", "zo", "net", "hack", "bin", "script", "ware", "sync", "data", "bot", "flux", "byte", "dex"]
suffixes = ["man", "ster", "face", "lord", "son", "zilla", "zilla", "borg", "bot", "crash", "dump", "node", "runner", "smith", "dev", "er"]

# Realistic first name base for humor
funny_first_parts = ["Al", "Ada", "Linus", "Dennis", "Tux", "Neo", "Codey", "Chip", "Bo", "Hex", "Algo", "Compu", "Syntax", "Clippy", "Macro", "Bitty", "Ramsey", "Debugger", "Loopie"]
funny_last_parts = ["McBug", "Stackover", "Segfault", "Bytecrusher", "Hackwell", "Crasher", "Binaire", "Kernelson", "Gitman", "OLoop", "Bitfield", "Nullman", "Coreburn", "Bugstein", "Devnull", "RAMirez", "Hackermann", "Cyberwitz", "Pinglish", "Cronwell"]

class GamesManager():

    def __init__(self):
        self.games = dict()
        self.number_allowed_alive_games = 10
        self.lengthOfRoomId = 6
        self.total_connection = 0
        self.randomNameConflictCounter= 0

    @property
    def roomsList(self):    
        # Use by the front end to show the players which game can be joined
        return [

            {
                "roomId":room.roomId,
                "name":room.roomName, 
                "numHumans": len(room.humans),
                "numBots": room.botsCardinality,
                "isStarted":room.table.ts.state != "waiting"
            }
            for roomId,room in self.games.items()
            if not room.isPrivate
        ]

    def generateRandomName(self, room:Room):
        # 50/50 mix of themed and random-style
        if random() < 0.5:
            first = choice(funny_first_parts)
            last = choice(funny_last_parts)
        else:
            first = choice(prefixes) + choice(middles)
            last = choice(prefixes) + choice(suffixes)
        name =  f"{first} {last}"
        if name in [p.name for p in room.players if p is not None]:
            name += self.randomNameConflictCounter
            self.randomNameConflictCounter += 1
        return name


    def generateRoomId(self):    
        
        roomId = "".join([ choice(idAlphabet) for _ in range(self.lengthOfRoomId) ])
        while self.doesRoomIdExist(roomId):
            roomId = "".join([ choice(idAlphabet) for _ in range(self.lengthOfRoomId) ])
        return roomId

    def doesRoomIdExist(self,roomId):
        for gameRoomId in self.games.keys():
            if roomId == gameRoomId :
                return True 
        return False 
    

    def createRoom(self,roomId,playerName, isPrivate, gameType):
        room = Room(
            roomId = roomId,
            roomName = playerName,
            isPrivate = isPrivate,
        ) 
        room.table.ts.gameType = gameType
        self.games[roomId] = room
        return room

    # Verify that the token is valid
    # return the tuple (action,value)
    def processGameToken(self,token):
        if ( 
            len(token) >= 40 or 
            any([(car not in alphanum+":, ") for car in token]) or
            not ( m:= re.match(r'^(\w+):((?:\w*\s*(?:\s*\w*)*)(?:,\s*\w*(?: \w*)*)*)$',token))
        ) : 
            raise HTTPException( status_code=400, detail="Bad game token.")

        return m[1], m[2]

    # Function is used check if a player can join, 
    # if a player can join, the second argument is its seat index
    # if the player cannot, the second argument is the error msg
    def wherePlayerCanJoin(self,roomId,playerName):
        # chech if room exist
        if not self.doesRoomIdExist(roomId):
            return False, "La table n'existe pas."
        room : Room = self.games[roomId]

        for player in room.players:
            # check if the name is not allready taken AND connected 
            if player is not None and player.name == playerName and player.isActive :
                return False, "Un jouer actif possède déjà ce nom."
            # check if player want to reconnect
            if player is not None and player.name == playerName and not player.isActive :
                return True, player.seat 

        # check is there is an available seat
        if not any(player is None for player in room.players):
            return False, "La table est pleine."

        # Sinon, retourne la première place libre (none)
        return True, room.players.index(None)

    # This function supposes that all verification is done and that the connection
    # is secure and will successfully connect to the room
    async def connect(self,ws:WebSocket,roomId,playerName,indexSeat):
        await ws.accept()
        self.total_connection += 1

        room : Room = self.games.get(roomId)
        # If no name was provided, generate one
        if playerName == "" : 
            playerName = self.generateRandomName(room)
            room.roomName = playerName
        # Easter egg
        elif re.match(r'[Mm]erci [Rr]obin',playerName):
            playerName = "Merci Samuel"
            room.roomName = playerName
        # Easter egg
        elif re.match(r'[Mm]erci [Ss]amuel',playerName):
            playerName = "Merci Robin"
            room.roomName = playerName

        print(f"{self.total_connection=}")
        # Create the player object and add it to the room
        player = Player(
            isActive = True,
            isBot = False,
            ws = ws,
            name = playerName,
            seat = indexSeat
        )
        # Populate the table/indexes of seats
        room.players[indexSeat] = player
        await self.playerAct("connectionAccepted","",room,player)

        try :
            # Main loop
            while True:
                action,value = self.processGameToken(await ws.receive_text())
                await self.playerAct(action,value,room,player)
        
        except WebSocketDisconnect:
            self.total_connection -= 1
            player.isActive = False
            print(f"{self.total_connection=}")
            # Del the room if no player in it. But let few seconds if the player just refreshed.
            await asyncio.sleep(1)
            if player.isActive : return
            if not any(player.isActive for player in room.activeHumans):
                self.games.pop(roomId,None)
            else :
                await self.updatePlayers(room, "playerChange")
        except Exception as e: 
            print(traceback.format_exc())
            for player in room.activeHumans:
                self.total_connection -= 1
                await player.ws.close()
            print(e)
            self.games.pop(roomId)

    # Update all the player in a room with an action that was taken
    async def updatePlayers(self, room : Room , action, msg=""):
        state : dict = room.state | { "action" : action, "msg":msg} 
        for player in room.activeHumans:
            state.update({
                "cards" : room.table.ts.hands[player.seat],
                "mySeat": player.seat, 
            })
            await player.ws.send_text({json.dumps(state)})

    # Update a single player
    async def updatePlayer(self, room, action, player, msg=""):
        state = room.state | {"action" : action, "msg":msg} 
        state.update({
            "cards" : room.table.ts.hands[player.seat],
            "mySeat": player.seat, 
        })
        await player.ws.send_text(json.dumps(state))

    async def botAct(self,room:Room):
        table = room.table
        repetition = 0
        while table.ts.state == "biding" and room.players[table.ts.turn].isBot :
            await asyncio.sleep(max(1,room.botTime2Act))
            botPlayer = room.players[table.ts.turn]
            bot : RandoBot = botPlayer.ws
            bid = bot.bid()
            print(f"{botPlayer.name} will bid:", bid)

            isValid, msg = table.isBidValid(botPlayer.seat, bid)
            if not isValid: 
                print("Invalid play by bot, freezing the game.",msg)
                break
            table.bid(botPlayer.seat, bid)
            await self.updatePlayers(room, "bid")
            repetition += 1
            if repetition > 10 : raise Exception("Infinite Loop")

        #Bot playing
        repetition = 0
        while table.ts.state == "playing" and room.players[table.ts.turn].isBot :
            await asyncio.sleep(max(1,room.botTime2Act))
            botPlayer = room.players[table.ts.turn]
            bot : RandoBot = botPlayer.ws
            suite, rank = bot.selectCard()
            print(f"{botPlayer.name} will play:", suite, rank)
            isValid, msg = table.isValidPlayCard(botPlayer.seat, [suite,rank]) 
            if not isValid : 
                print("Invalid play by bot, freezing the game.",msg)
                break
            table.playCard(botPlayer.seat, [suite,rank])
            await self.updatePlayers(room, "cardPlayed", msg=f"{botPlayer.seat},{suite},{rank}")
            repetition += 1
            if repetition > 10 : raise Exception("Infinite Loop")

    async def playerAct(self,action:str,value:str,room:Room,player:Player):
        print(action,value)
        table : Table = room.table
        match action:

            case "connectionAccepted":
                await self.updatePlayer(room, "update", player, msg="")
                await self.updatePlayers(room, "playerChange")

            case "nameChange":
                newName = value
                if (len(newName) >= 21 or len(newName) <= 2) : return
                if newName in [
                    p.name
                    for p in room.players
                    if p is not None
                ]: return # If name allready taken, do nothing as we don't want duplicate.
                player.name = newName
                if (player.seat == room.host):
                    room.roomName = newName
                await self.updatePlayers(room, "playerChange")

            case "bid":
                if not re.match(r'^(?:\d{1,3})$', value) :
                    self.updatePlayer(room, "invalid", player, msg="Bad bid token.")
                    player.ws.close() ; return
                bid = int(value)
                isValid, msg = table.isBidValid(player.seat,bid)
                if isValid :
                    table.bid(player.seat, bid)
                    await self.updatePlayers(room, "bid")
                else :
                    await self.updatePlayer(room, "invalid", player, msg=msg)
                
            case "update":
                await self.updatePlayers(room, "update")

            case "changeSeat":
                if table.ts.state != "waiting" : return
                if not (m := re.match(r'[0-3]',value)) : 
                    print("Not a correct seat")
                    player.ws.close()
                    return


                askingPlayerNewSeat = int(value) 
                forcedPlayerNewSeat = player.seat

                askingPlayer = player
                forcedPlayer = room.players[askingPlayerNewSeat]

                if room.host == player.seat : 
                    room.host = askingPlayerNewSeat

                if forcedPlayer is not None and room.host == forcedPlayer.seat:
                    room.host = askingPlayer.seat

                askingPlayer.seat = askingPlayerNewSeat
                room.players[askingPlayerNewSeat] = askingPlayer

                room.players[forcedPlayerNewSeat] = forcedPlayer
                if forcedPlayer is not None:
                    forcedPlayer.seat = forcedPlayerNewSeat

                await self.updatePlayers(room, "playerChange")

            case "botTime2Act":
                if player.seat != room.host : return
                if not (m := re.match(r'\d{1,2}',value)) : return
                sec = int(value)
                if ( sec > 10 or sec < 1 ): return
                room.botTime2Act = int(value)

            case "newHand":
                if player.seat != room.host : return
                table.newHand()
                room.fillEmptySeatsWithRandoBot()
                await self.updatePlayers(room, "newHand")

            case "newGame":
                if player.seat != room.host : return
                # Only keep active players, dismissing not connected players.
                room.kickNotActiveHumans()
                table.newGame()
                await self.updatePlayers(room, "update")

            case "playCard":
                if ( not re.match(r'^[0-3],(?:5|6|7|8|9|1[0-4])$',value)):
                    self.updatePlayer(room, "invalid", player, msg="Bad card token.")
                    player.ws.close() ; return
                suite,rank = map(int,value.split(","))
                isValid, validationMsg = table.isValidPlayCard(player.seat,[suite,rank])
                if isValid : 
                    table.playCard(player.seat,[suite,rank])
                    await self.updatePlayers(room, "cardPlayed", msg=f"{player.seat},{suite},{rank}")

                else :  #Is not a valid playCard action
                    await self.updatePlayer(room, "invalid", player, msg=validationMsg)
            case _:
                player.ws.send_text(json.dumps({isValid:False , "validationMsg" : "Bad game token"}))
                player.ws.close() ; return

        await self.botAct(room)

                