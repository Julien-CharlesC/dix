from typing import List, Optional, Tuple, Any
from pydantic import BaseModel, Field
from fastapi import WebSocket
import sys, os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from Table import Table

class Player(BaseModel):
    isActive : bool
    isBot : bool
    ws : Optional[WebSocket]
    name : str
    seat : int
    model_config = {
        "arbitrary_types_allowed": True
    }

class Room(BaseModel):
    roomId :str 
    table : Table = Field(Table())
    roomName : str
    players : List[Optional[Player]] = Field([None]*4)
    model_config = {
        "arbitrary_types_allowed": True
    }

    def kickNoneHumans(self):
        self.players = [
            player 
            if player is not None and player.isActive and not player.isBot else None
            for player in self.players 
        ]

    def fillEmptySeatsWithRandoBot(self):
        self.players = [
            player 
            if player is not None
            else 
            Player(
                isActive = True,
                isBot = True,
                ws = None,
                name = "RandoBot",
                seat =seat 
            )
            for seat, player in enumerate(self.players)
        ]

    @property
    def humans(self):
        return [
            player 
            for player in self.players 
            if player is not None and player.isActive and not player.isBot
        ]

    @property
    def state(self):
        return {
            "roomId" : self.roomId,
            "roomName" : self.roomName,
            "players" : [
                {
                    "name" : player.name,
                    "isBot": player.isBot, 
                    "isActive": player.isActive, 
                    "seat": player.seat
                } if player is not None 
                else  None
                for player in self.players
            ]
        } | self.table.state