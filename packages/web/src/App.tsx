import React, { useState } from 'react';
import { useTarokGame } from './hooks/useTarokGame';
import { PlayingCard } from './components/PlayingCard';
import { type Card, type Bid, BIDS, PASS } from '@tarok/engine';

function App() {
  const { 
    gameState, 
    startGame, 
    HUMAN_PLAYER,
    playBid,
    playCall,
    playTalonPick,
    playDiscard,
    playAnnouncementPass,
    playCard
  } = useTarokGame();

  const [selectedDiscards, setSelectedDiscards] = useState<Card[]>([]);

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-8 text-yellow-400 drop-shadow-lg">TAROK</h1>
          <button 
            onClick={startGame}
            className="px-8 py-4 bg-yellow-500 text-green-900 font-bold rounded shadow hover:bg-yellow-400 text-xl transition-colors"
          >
            Nova Igra
          </button>
        </div>
      </div>
    );
  }

  const myHand = gameState.hands[HUMAN_PLAYER] || [];
  const isMyTurn = gameState.currentPlayer === HUMAN_PLAYER;

  const handleCardClick = (card: Card) => {
    if (!isMyTurn) return;

    if (gameState.phase === "playing") {
      playCard(card);
    } else if (gameState.phase === "talon" && gameState.pickedTalonGroupIndex !== undefined) {
      // Toggle discard selection
      const isSelected = selectedDiscards.some(c => JSON.stringify(c) === JSON.stringify(card));
      if (isSelected) {
        setSelectedDiscards(selectedDiscards.filter(c => JSON.stringify(c) !== JSON.stringify(card)));
      } else {
        // Find exchange count
        let exchangeCount = 3;
        if (gameState.contract === "dve" || gameState.contract === "solo_dve") exchangeCount = 2;
        if (gameState.contract === "ena" || gameState.contract === "solo_ena") exchangeCount = 1;
        
        if (selectedDiscards.length < exchangeCount) {
          setSelectedDiscards([...selectedDiscards, card]);
        }
      }
    }
  };

  const handleConfirmDiscard = () => {
    playDiscard(selectedDiscards);
    setSelectedDiscards([]);
  };

  return (
    <div className="flex flex-col min-h-screen p-4">
      {/* Top area - opponent info / game status */}
      <div className="flex justify-between items-start bg-green-900/50 p-4 rounded mb-8">
        <div>
          <h2 className="text-xl font-bold text-yellow-300">Faza: {gameState.phase.toUpperCase()}</h2>
          <p>Trenutno na potezi: Igralec {gameState.currentPlayer}</p>
        </div>
        <div className="text-right">
          <p>Licitacija: {gameState.contract || "Poteka..."}</p>
          <p>Igra: {gameState.declarer !== undefined ? `Igralec ${gameState.declarer}` : "Nihče"}</p>
          {gameState.calledKing && (
            <p>Klican Kralj: {gameState.calledKing.suit}</p>
          )}
        </div>
      </div>

      {/* Middle area - Action Panel & Table */}
      <div className="flex-grow flex flex-col items-center justify-center relative">
        
        {/* Action Panel for Bidding/Calling/Talon */}
        {isMyTurn && gameState.phase === "bidding" && (
          <div className="absolute top-0 bg-gray-800 p-4 rounded flex gap-2 z-10">
            {BIDS.map(bid => (
              <button key={bid} onClick={() => playBid(bid as Bid)} className="px-4 py-2 bg-blue-600 rounded text-white">{bid}</button>
            ))}
            <button onClick={() => playBid(PASS)} className="px-4 py-2 bg-red-600 rounded text-white">Naprej</button>
          </div>
        )}

        {isMyTurn && gameState.phase === "calling" && (
          <div className="absolute top-0 bg-gray-800 p-4 rounded flex gap-2 z-10">
            <p className="text-white mr-4 self-center">Kliči Kralja:</p>
            {["hearts", "diamonds", "clubs", "spades"].map(suit => (
              <button key={suit} onClick={() => playCall(suit as any)} className="px-4 py-2 bg-blue-600 rounded text-white capitalize">{suit}</button>
            ))}
          </div>
        )}

        {isMyTurn && gameState.phase === "announcements" && (
          <div className="absolute top-0 bg-gray-800 p-4 rounded flex gap-2 z-10">
            <button onClick={() => playAnnouncementPass()} className="px-4 py-2 bg-red-600 rounded text-white">Naprej (brez napovedi)</button>
          </div>
        )}

        {isMyTurn && gameState.phase === "talon" && gameState.pickedTalonGroupIndex === undefined && (
           <div className="absolute top-0 bg-gray-800 p-4 rounded flex gap-4 z-10">
             <p className="text-white self-center">Izberi Talon:</p>
             {/* Note: Engine doesn't expose talonGroups natively on state without round, but we know sizes. */}
             {/* For demo, just provide buttons for the correct number of groups */}
             {[0, 1, 2, 3, 4, 5].slice(0, 
                gameState.contract?.includes("ena") ? 6 : 
                gameState.contract?.includes("dve") ? 3 : 2
             ).map(idx => (
               <button key={idx} onClick={() => playTalonPick(idx)} className="px-4 py-2 bg-purple-600 rounded text-white">Kupček {idx + 1}</button>
             ))}
           </div>
        )}

        {isMyTurn && gameState.phase === "talon" && gameState.pickedTalonGroupIndex !== undefined && (
          <div className="absolute top-0 bg-gray-800 p-4 rounded flex gap-2 z-10">
             <p className="text-white self-center">Izberi karte za založiti ({selectedDiscards.length} izbranih)</p>
             <button onClick={handleConfirmDiscard} className="px-4 py-2 bg-green-600 rounded text-white">Potrdi zalog</button>
          </div>
        )}

        {/* The Table */}
        {gameState.trickRound && (
          <div className="bg-green-700 w-96 h-96 rounded-full border-8 border-green-900 shadow-2xl relative flex items-center justify-center">
            {gameState.trickRound.currentTrick.plays.map((play, idx) => (
              <div key={idx} className="absolute" style={{
                transform: `rotate(${play.playerId * 90}deg) translateY(-80px) rotate(-${play.playerId * 90}deg)`
              }}>
                <PlayingCard card={play.card} disabled />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom area - player hand */}
      <div className="mt-8 bg-green-900/80 p-6 rounded shadow-xl overflow-x-auto relative">
        <h3 className="mb-4 font-bold text-gray-300">Tvoje karte (Igralec {HUMAN_PLAYER})</h3>
        <div className="flex gap-2 w-max">
          {myHand.map((card, idx) => {
            const isSelected = selectedDiscards.some(c => JSON.stringify(c) === JSON.stringify(card));
            return (
              <div key={idx} className={isSelected ? "-translate-y-4 transition-transform" : ""}>
                <PlayingCard 
                  card={card} 
                  disabled={!isMyTurn}
                  onClick={() => handleCardClick(card)} 
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
