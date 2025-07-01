# Jeu du dix

Jeu du dix is a web-based multiplayer card game, implementing the official rules of the AÉDIROUM's "Jeu du dix". The project features a FastAPI backend, real-time gameplay via WebSockets, and a modern HTML/CSS/JS frontend.

## Features
- Multiplayer card game (up to 4 players per table)
- Play with friends or bots
- Real-time gameplay using WebSockets
- Custom audio and graphical assets
- Game rules available online ([wiki](https://wiki.aediroum.ca/wiki/Jeu_du_10))

## Requirements
- Python 3.12
- [pipenv](https://pipenv.pypa.io/en/latest/) or pip

### Python dependencies (install manually if not using pipenv):
- fastapi
- uvicorn
- pydantic


## Running the Server
Start the FastAPI server with Uvicorn:
```bash
python main.py
```
The server will be available at [http://localhost:5000](http://localhost:5000) by default.

## Usage
- Host the service on a server and redirect to [http://localhost:5000](http://localhost:5000)
- Create a new table or join an existing one
- Share the table URL with friends to play together
- You can also play with a Random bot (more bots in the futur) if there are empty seats

## Project Structure
- `main.py` — FastAPI entrypoint
- `GamesManager.py` — Game and room management logic
- `Models/` — Game models (Room, Table, Bots, etc.)
- `static/` — Frontend HTML, CSS, JS, and static assets
- `graphics/` — SVG graphics for cards and UI
- `audio/` — MP3 sound effects

## Assets
- All required graphics and audio assets are included in `graphics/` and `audio/`
- The frontend is fully static and does not require a build step

## Game Rules
For the official rules, see: [wiki.aediroum.ca/wiki/Jeu_du_10](https://wiki.aediroum.ca/wiki/Jeu_du_10)

## Notes
- The project is under active development. Some features (animations, chat, etc.) may be incomplete.
- For bug reports or feature requests, please open an issue.

---
© AÉDIROUM, 2024 
