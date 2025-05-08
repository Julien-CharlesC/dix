from random import shuffle, choice
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
        self.ts.points = [ a+b for a,b in zip(self.ts.points, self.ts.currentPoints)]
        self.ts.state = "end"

    def askedSuite(self):
        count = self.count_played_cards()
        if count == 0 : return None
        return self.ts.center[(self.ts.turn-count)%4][0]

    def count_played_cards(self) :
        return sum(1 for card in self.ts.center if card is not None)

    def newHand(self):
        # Save informations
        points = self.ts.points.copy() 
        dealer = self.ts.dealer

        # Refresh the table state
        self.newGame()
        #TODO fix for biding
        self.ts.state = "playing"
        self.ts.points = points
        self.ts.dealer = self.ts.turn =  dealer
        deck = [
            [suit,card] for suit in range(4) for card in range(5,15)
        ]
        shuffle(deck)
        for i in range(4):
            self.ts.hands[i] = sorted(deck[i*10:(i+1)*10])[::-1]

    
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

        print(f"{winningPlayer=}")
        if winningPlayer in [0,2]: 
            self.ts.currentPoints[0] += points
        else:
            self.ts.currentPoints[1] += points
        self.ts.lastCenter = deepcopy(self.ts.center)
        self.ts.center = [None for _ in range(4)]
        self.ts.turn = winningPlayer

    def isHandFinish(self):
        return all(len(hand) == 0 for hand in self.ts.hands)

    def randomCard(self, player):
        if self.ts.hands[player] == 0 :
            print("Should not happen.")
            return None
        if self.count_played_cards() == 0 :
            return choice(self.ts.hands[player])
        else :
            askedSuite = self.askedSuite()
            askedSuiteCards = self.getPlayerSuite(player,askedSuite)
            if len(askedSuiteCards) == 0 :
                return choice(self.ts.hands[player])
            else:
                return choice(askedSuiteCards)

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
