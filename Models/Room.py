from typing import List, Optional, Tuple, Any, Union
from pydantic import BaseModel, Field
from fastapi import WebSocket
from Models.Table import Table
from Models.RandoBot import RandoBot

class Player(BaseModel):
    isActive : bool
    isBot : bool
    ws : Any #Is either WebSocket or a bot object
    name : str
    seat : int
    model_config = {
        "arbitrary_types_allowed": True
    }

class Room(BaseModel):
    isPrivate: bool = Field(False)
    roomId :str 
    table : Table = Field(default_factory = Table)
    roomName : str
    players : List[Optional[Player]] = Field(default_factory=lambda:[None]*4)
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
                ws = RandoBot(seat, self.table),
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
    def botsCardinality(self):
        return sum([
            1
            for player in self.players 
            if player is not None and player.isBot
        ])

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