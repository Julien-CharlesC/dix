from random import shuffle
from Models.TableState import TableState
from copy import deepcopy

class Table():
    def __init__(self):
        self.newGame()

    @property
    def state(self):
        return self.ts.to_dict() # For the gamesManager

    def getTableState(self):
        return self.ts.dict()

    def newGame(self):
        self.ts = TableState()

    def endHand(self):
        self.ts.dealer = (self.ts.dealer+1)%4
        bids = self.ts.bids
        bestBid = max(bids)
        bidWinner = bids.index(bestBid)%2
        if self.ts.currentPoints[bidWinner] >= bestBid :
            self.ts.points[bidWinner] += self.ts.currentPoints[bidWinner]
        else :
            self.ts.currentPoints[bidWinner] = -bestBid
            self.ts.points[bidWinner] -= bestBid 
        otherTeam = (bidWinner+1)%2
        if (
            (self.ts.points[otherTeam] >= 400 and self.ts.hasBided[otherTeam]) or
            self.ts.gameType == "inf"
  
        ):
            self.ts.points[otherTeam] += self.ts.currentPoints[otherTeam]
        self.ts.state = "end"
        self.ts.bidsHistory.append(self.ts.bids.copy())
        self.ts.pointsHistory.append(self.ts.currentPoints.copy())

    def askedSuite(self):
        count = self.count_played_cards()
        if count == 0 : return None
        return self.ts.center[(self.ts.turn-count)%4][0]

    def count_played_cards(self) :
        return sum(1 for card in self.ts.center if card is not None)

    def newHand(self):

        if self.ts.gameType=="500" and any(p>=500 for p in self.ts.points):
            return

        self.ts.state = "biding"
        self.ts.turn =  self.ts.dealer
        self.ts.currentPoints = [0,0]
        self.ts.bids = [None]*4
        self.ts.lastCenter = [None]*4
        self.ts.trump = None

        #FIXME TODO dev
        """
        self.ts.pointsHistory = [
            [50,75],
            [125,25],
            [65,40]
        ]
        """


        deck = [
            [suit,card] for suit in range(4) for card in range(5,15)
        ]
        shuffle(deck)
        for i in range(4):
            self.ts.hands[i] = sorted(deck[i*10:(i+1)*10])

    
    def playerHasCard(self, player, card):
        return card in self.ts.hands[player]
    def isPlayerTurn(self,player):
        return self.ts.turn == player
    def getPlayerSuite(self,player,suite):
        return [
            card for card in self.ts.hands[player]
            if card[0] == suite
        ]
    def isValidPlayCard(self,player,card):
        if player < 0 or player >=4 :
            return False, "Not a playerSeat."
        if not self.ts.state == "playing":
            return False, "Pas encore le temps de jouer."
        if not self.isPlayerTurn(player) :
            return False, "Pas ton tour."
        if not self.playerHasCard(player,card) :
            return False, "Coquin, tu n'as pas la carte."

        if self.count_played_cards() == 0 : 
            return True, "Good."
        
        askedSuite = self.askedSuite()
        playerSuite = self.getPlayerSuite(player,askedSuite)
        if len(playerSuite) == 0 :
            return True, "Good."

        isValid = (card in playerSuite)
        if isValid : return True, "Good."
        else: return False, "Coquin, ce n'est pas la sorte demandée."

    def lever(self):
        askedSuite = self.askedSuite()
        trump = self.ts.trump
        cards = set([
            (card[0], card[1], i )
            for i,card in enumerate(self.ts.center)
        ])
        trumpsCards = [
            card for card in cards 
            if card[0] == trump
        ]
        if len(trumpsCards) != 0:
            winningPlayer = sorted(trumpsCards)[::-1][0][2]
        else:
            askedSuitesCards = [
                card for card in cards 
                if card[0] == askedSuite 
            ]
            winningPlayer = sorted(askedSuitesCards)[::-1][0][2]
        points = 0
        for card in cards :
            if card[1] == 5 : points += 5
            if card[1] in [10,14]: points += 10 

        if winningPlayer in [0,2]: 
            self.ts.currentPoints[0] += points
        else:
            self.ts.currentPoints[1] += points
        self.ts.lastCenter = deepcopy(self.ts.center)
        self.ts.center = [None for _ in range(4)]
        self.ts.turn = winningPlayer

    def isHandFinish(self):
        return all(len(hand) == 0 for hand in self.ts.hands)


    # Suposes that it is valid
    def playCard(self, player, card):
        if self.ts.trump is None:
            self.ts.trump = card[0]
        self.ts.turn = (self.ts.turn + 1)%4
        self.ts.hands[player].remove(card)
        self.ts.center[player] = card
        if self.count_played_cards() == 4 :
            self.lever()
        if self.isHandFinish() :
            self.endHand()

    # If the first 3 players passed, then the last player must bid.
    def isForcedToBid(self):
        bids = self.ts.bids
        return all(
            bids[(self.ts.turn-i)%4] == 0
            for i in range(1,4)
        ) and self.ts.bids[self.ts.turn] == None

    def isBidValid(self, seat, bid):
        if self.ts.turn != seat:
            return False, "Pas ton tour de miser."
        if self.ts.state != "biding":
            return False, "Pas le moment de miser."
        if bid == 0 :
            return True, "Good."
        if (bid > 100 or bid < 50) :
            return False, "La mise doit être entre 50 et 100."
        if bid%5 != 0 :
            return False, "La mise doit être un multiple de 5."

        bids = [ bid for bid in self.ts.bids if bid is not None ]

        # No bid before.
        if len(bids) == 0 :
            return True, "Good."

        best_bid = max(
            bid for bid in bids
        )
        if bid > best_bid :
            return True, "Good."
        else :
            return False, "Doit surenchérir."

    # Supposes that the bid is valid
    def bid(self, seat, bid):
        bids = self.ts.bids
        bids[seat] = bid 
        if bid != 0 : self.ts.hasBided[seat%2] = True
        if bid == 100:
            self.ts.bids = [0]*4
            self.ts.bids[seat] = 100
            self.ts.turn = seat
            self.ts.state = "playing"
            return

        # This increment the turn to the next seat whose's turn is to bid. 
        i = 0
        print(self.ts.turn, bids)
        self.ts.turn = (self.ts.turn+1)%4
        while self.ts.bids[self.ts.turn] == 0 :
            self.ts.turn = (self.ts.turn+1)%4
            i += 1
            if i > 10 : raise Exception("Infinite Loop")

        # No bids, forced to bid 50.
        if self.isForcedToBid():
            bids[self.ts.turn] = 50
            self.ts.hasBided[self.ts.turn%2] = True
            self.ts.state = "playing"
            return
        # All other players have passed, player win the bids.
        if sum(bid == 0 for bid in bids) == 3 :
            self.ts.state = "playing"