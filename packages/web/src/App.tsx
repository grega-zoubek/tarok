import { useEffect, useState } from "react";
import { useTarokGame } from "./hooks/useTarokGame";
import { cardsEqual, getExchangeCount, getHand, getRequiredTalonGroup } from "@tarok/engine";
import type { Card } from "@tarok/engine";
import { Scoreboard } from "./components/Scoreboard";
import { GameTable } from "./components/GameTable";
import { Hand } from "./components/Hand";
import { ResultsOverlay } from "./components/ResultsOverlay";
import { FinalScoreboard } from "./components/FinalScoreboard";
import { SetupScreen } from "./components/SetupScreen";
import { ErrorOverlay } from "./components/ErrorOverlay";
import { SESSION_STORAGE_KEY } from "./lib/session";
import { strings } from "./lib/strings";

function App() {
  const {
    gameState,
    startGame,
    HUMAN_PLAYER,
    playerNames,
    playerRadlci,
    playerScores,
    lastCapturedTrick,
    isProcessingTrick,
    isMovingCards,
    showKlopTalon,
    currentRound,
    currentSeed,
    maxRounds,
    history,
    roundScore,
    nextRound,
    playBid,
    playCall,
    playTalonPick,
    playDiscard,
    playAnnouncement,
    playAnnouncementPass,
    playCard,
    errorMessage,
    clearError,
  } = useTarokGame();

  const [selectedDiscards, setSelectedDiscards] = useState<Card[]>([]);
  const [showFinalScore, setShowFinalScore] = useState(false);

  // Ob menjavi kroga ali faze počistimo morebitni prejšnji izbor za talon.
  useEffect(() => {
    setSelectedDiscards([]);
  }, [currentRound, gameState?.phase]);

  const resetSession = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    window.location.reload();
  };

  if (showFinalScore) {
    return (
      <FinalScoreboard
        playerNames={playerNames}
        playerScores={playerScores}
        history={history}
        maxRounds={maxRounds}
        humanPlayer={HUMAN_PLAYER}
        onNewGame={resetSession}
      />
    );
  }

  if (!gameState) {
    return <SetupScreen onStart={startGame} />;
  }

  const myHand = getHand(gameState, HUMAN_PLAYER);
  const isMyTurn = gameState.currentPlayer === HUMAN_PLAYER;
  const exchangeCount = getExchangeCount(gameState.contract);
  const requiredTalonGroup = getRequiredTalonGroup(gameState);
  const currentResult = history[history.length - 1];

  const handleCardClick = (card: Card) => {
    if (!isMyTurn) return;

    if (gameState.phase === "playing") {
      playCard(card);
    } else if (gameState.phase === "talon" && gameState.pickedTalonGroupIndex !== undefined) {
      const isSelected = selectedDiscards.some((c) => cardsEqual(c, card));
      if (isSelected) {
        setSelectedDiscards(selectedDiscards.filter((c) => !cardsEqual(c, card)));
      } else if (selectedDiscards.length < exchangeCount) {
        setSelectedDiscards([...selectedDiscards, card]);
      }
    }
  };

  const handleConfirmDiscard = () => {
    playDiscard(selectedDiscards);
    setSelectedDiscards([]);
  };

  const status =
    gameState.phase === "finished"
      ? strings.table.finished
      : isMyTurn
        ? strings.table.yourTurn
        : gameState.currentPlayer !== undefined
          ? strings.table.waitingFor(
              playerNames[gameState.currentPlayer] ?? strings.table.nobody,
            )
          : strings.table.waitingFallback;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-green-800 text-white font-sans overflow-hidden">
      <Scoreboard
        playerNames={playerNames}
        playerScores={playerScores}
        playerRadlci={playerRadlci}
        history={history}
        currentRound={currentRound}
        maxRounds={maxRounds}
        currentSeed={currentSeed}
        humanPlayer={HUMAN_PLAYER}
        onQuit={resetSession}
      />

      <main className="flex-grow flex flex-col p-2 sm:p-4 relative min-h-0">
        <GameTable
          gameState={gameState}
          playerNames={playerNames}
          humanPlayer={HUMAN_PLAYER}
          isMyTurn={isMyTurn}
          isProcessingTrick={isProcessingTrick}
          isMovingCards={isMovingCards}
          showKlopTalon={showKlopTalon}
          lastCapturedTrick={lastCapturedTrick}
          requiredTalonGroup={requiredTalonGroup}
          exchangeCount={exchangeCount}
          selectedDiscards={selectedDiscards}
          onBid={playBid}
          onCall={playCall}
          onTalonPick={playTalonPick}
          onDiscardConfirm={handleConfirmDiscard}
          onAnnounce={playAnnouncement}
          onAnnouncePass={playAnnouncementPass}
        />

        {gameState.phase === "finished" && roundScore && (
          <ResultsOverlay
            gameState={gameState}
            roundScore={roundScore}
            currentResult={currentResult}
            playerNames={playerNames}
            humanPlayer={HUMAN_PLAYER}
            currentRound={currentRound}
            maxRounds={maxRounds}
            onNextRound={nextRound}
            onShowFinalScore={() => setShowFinalScore(true)}
          />
        )}

        <Hand
          cards={myHand}
          isMyTurn={isMyTurn}
          selectedDiscards={selectedDiscards}
          status={status}
          statusActive={isMyTurn}
          onCardClick={handleCardClick}
        />
      </main>

      {errorMessage && <ErrorOverlay message={errorMessage} onClose={clearError} />}
    </div>
  );
}

export default App;
