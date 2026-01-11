# Guesstures 🎭

A multiplayer charades game built with React TypeScript and Express TypeScript.

## Features

- **User Authentication**: Register, login, or continue as a guest
- **Game Creation**: Create custom games with team names
- **Two Teams**: Alternate turns between Team 1 and Team 2
- **30-Second Timer**: Each turn has a countdown timer
- **Score Tracking**: Points awarded for correct guesses
- **Multiple Rounds**: Games have 3 rounds by default
- **Shareable Links**: Non-players can watch games via share code
- **Persistent State**: Game state survives browser refresh

## Tech Stack

- **Frontend**: React 19, TypeScript, React Router, Vite
- **Backend**: Express 5, TypeScript, Bun
- **Database**: SQLite (bun:sqlite)

## Running Locally

```bash
# Install dependencies
cd api && bun install
cd ../client && bun install

# Build the client
cd client && bun run build

# Run the server
cd api && bun run index.ts
```

The app will be available at http://localhost:8000

## How to Play

1. **Create or Join a Game**:
   - Log in or continue as guest
   - Create a new game or join using a share code

2. **Teams Setup**:
   - Players join either Team 1 or Team 2
   - Game creator starts the game when both teams have players

3. **Taking Turns**:
   - Teams take turns having a player act out words
   - The acting player clicks "Start Turn" to begin
   - 30 seconds to act out as many words as possible
   - Click "Correct!" when teammates guess correctly
   - Click "Skip" to get a new word

4. **Winning**:
   - Play through all rounds
   - Team with the most points wins!

## Share URL Format

Games can be shared using the format:
```
https://guesstures.exe.xyz:8000/game/CODE
```

Where CODE is the 6-character share code displayed in the game.
