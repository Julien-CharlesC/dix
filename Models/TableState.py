from typing import List, Optional, Tuple
from pydantic import BaseModel, Field
class TableState(BaseModel):
    dealer : int = Field(
        0, 
        description="Seat index of the players how's turn is to deal."
        )
    turn : int = Field(
        0, 
        description="Seat index of the players how's turn is to play."
        )
    trump : int = Field(
        None,
    )
    gameType : str = Field(
        "inf",
        description="Determine the rules of terminating the game or not."
    )
    center : List[Optional[List[int]]] = Field(
        default_factory = lambda :[None]*4, 
        description ="The card in the center of the table. Indexed by their respective player."
    )
    bids : List[int] = Field(
        default_factory=lambda:[None]*4,
        description = "The bids of the players, indexed with their seats."
    )
    hasBided : List[bool] = Field(
        default_factory = lambda : [False,False],
        description= "Is used for the gameType 500 points, where one must bid to gain point over 400 points."
    )
    bidsHistory : List[List[int]] = Field(
        default_factory=lambda:[],
        description = "The history of each round final bids."
    )
    points : List[int] = Field(
        default_factory=lambda:[0,0],
        description = "The points overall points the two teams over all finished hands."
    )
    pointsHistory : List[List[int]] = Field(
        default_factory=lambda:[],
        description = "The history of each round points."
    )
    hands : List[List[List[int]]] = Field(
        default_factory=lambda:[[] for _ in range(4)],
        description = "The hands of the players."
    )
    currentPoints : List[int] = Field(
        default_factory=lambda:[0,0],
        description = "The points of the two teams for the current hand."
    )
    state: str = Field(
        "waiting",
        description = "The state of the game: waiting, biding, playing, end."
    )
    lastCenter : List[Optional[List[int]]] = Field(
        default_factory=lambda:[None]*4, 
        description ="The last center before the 'lever'."
    )

    def to_dict(self):
        tableState = self.dict()
        tableState.pop("hands")
        tableState.pop("currentPoints")
        moreInfos = {"cardinality" : [len(hand) for hand in self.hands] }
        return tableState | moreInfos
