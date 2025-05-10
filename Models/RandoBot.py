from Models.Table import Table
from random import choice

class RandoBot :

    def __init__(self, seat, table):
        self.table : Table = table
        self.seat = seat

    @property
    def hand(self):
        return self.table.ts.hands[self.seat]

    def selectCard(self):

        if len(self.hand) == 0 :
            print("Empty hand.")
            return None

        if self.table.count_played_cards() == 0 :
            return choice(self.hand)
        else :
            askedSuite = self.table.askedSuite()
            askedSuiteCards = self.table.getPlayerSuite(self.seat,askedSuite)
            if len(askedSuiteCards) == 0 :
                return choice(self.hand)
            else:
                return choice(askedSuiteCards)

    # 0 mean pass
    def bid(self):
        if all(bid is None for bid in self.table.ts.bids):
            return 50
        else:
            return 0